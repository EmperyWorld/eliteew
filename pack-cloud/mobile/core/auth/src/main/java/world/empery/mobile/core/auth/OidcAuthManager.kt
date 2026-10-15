/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC authorization-code flow via AppAuth (PKCE, state, discovery fetch).
 *
 * Invariants:
 * - User-visible errors use core.auth string resources; never log codes/tokens.
 *
 * Related:
 * - AuthRepository, AppAuth AuthorizationService, MobileSsoLaunchPlanner
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.net.HttpURLConnection
import java.util.UUID
import kotlin.coroutines.resume
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationException.AuthorizationRequestErrors
import net.openid.appauth.AuthorizationException.GeneralErrors
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.CodeVerifierUtil
import net.openid.appauth.ResponseTypeValues
import net.openid.appauth.connectivity.ConnectionBuilder
import net.openid.appauth.connectivity.DefaultConnectionBuilder

/**
 * OIDC authorization-code flow via AppAuth: PKCE, state, parsed callback results, and optional
 * discovery fetch with connect/read timeouts. User-visible strings are safe for UI; do not log
 * authorization codes, tokens, or verifiers.
 */
class OidcAuthManager(
    private val appContext: Context,
    private val authorizationService: AuthorizationService,
    private val authorizationEndpoint: String,
    private val tokenEndpoint: String,
    private val clientId: String,
    private val redirectUri: String,
) {
    private fun msgNetwork(): String = appContext.getString(R.string.auth_oidc_network_error)

    private fun msgServer(): String = appContext.getString(R.string.auth_oidc_server_unavailable)

    private fun msgTryLater(): String = appContext.getString(R.string.auth_oidc_try_later)

    private fun msgStateMismatch(): String = appContext.getString(R.string.auth_oidc_state_mismatch)

    private fun msgSession(): String = appContext.getString(R.string.auth_oidc_session_invalid)

    private fun msgGeneric(): String = appContext.getString(R.string.auth_oidc_generic_failed)

    /**
     * Builds a login [Intent] plus [OidcLoginRequest.state] and [OidcLoginRequest.codeVerifier] for
     * [AuthRepository.setPendingLogin] before starting the browser/custom tab flow.
     */
    fun createLoginRequest(
        scope: String = "openid profile email",
        customTabsBrowserPackage: String? = null,
    ): OidcLoginRequest {
        require(clientId.isNotBlank()) { "clientId must not be blank" }
        val authEndpoint = parseHttpEndpoint(authorizationEndpoint, fieldName = "authorizationEndpoint")
        val tokEndpoint = parseHttpEndpoint(tokenEndpoint, fieldName = "tokenEndpoint")
        val redir = parseRedirectUri(redirectUri)
        val wireRedirectUri = MobileOAuthRedirectUris.canonicalize(redirectUri)

        val state = UUID.randomUUID().toString()
        val codeVerifier = CodeVerifierUtil.generateRandomCodeVerifier()
        val request =
            buildAuthorizationRequest(
                authEndpoint = authEndpoint,
                tokenEndpoint = tokEndpoint,
                redirectUri = redir,
                scope = scope,
                state = state,
                codeVerifier = codeVerifier,
            )
        val intent = createAuthorizationLaunchIntent(request, customTabsBrowserPackage)
        return OidcLoginRequest(
            intent = intent,
            authorizationUrl = request.toUri().toString(),
            // Must match redirect_uri query param AppAuth embeds (token exchange + Keycloak).
            redirectUri = wireRedirectUri,
            state = state,
            codeVerifier = codeVerifier,
            scope = scope,
        )
    }

    /**
     * Rebinds AppAuth Custom Tabs to [customTabsBrowserPackage] while preserving PKCE [loginRequest] fields.
     */
    fun createAuthorizationLaunchIntent(
        loginRequest: OidcLoginRequest,
        customTabsBrowserPackage: String?,
    ): Intent {
        val authEndpoint = parseHttpEndpoint(authorizationEndpoint, fieldName = "authorizationEndpoint")
        val tokEndpoint = parseHttpEndpoint(tokenEndpoint, fieldName = "tokenEndpoint")
        val request =
            buildAuthorizationRequest(
                authEndpoint = authEndpoint,
                tokenEndpoint = tokEndpoint,
                redirectUri = parseRedirectUri(loginRequest.redirectUri),
                scope = loginRequest.scope,
                state = loginRequest.state,
                codeVerifier = loginRequest.codeVerifier,
            )
        return createAuthorizationLaunchIntent(request, customTabsBrowserPackage)
    }

    /**
     * Prefer [createLoginRequest]: the returned [Intent] alone is not enough to complete PKCE
     * token exchange—you must persist [OidcLoginRequest.state] and [OidcLoginRequest.codeVerifier].
     */
    @Deprecated(
        message = "Use createLoginRequest() and persist state + code_verifier for token exchange.",
        replaceWith = ReplaceWith("createLoginRequest(scope).intent"),
    )
    fun createLoginIntent(scope: String = "openid profile email"): Intent = createLoginRequest(scope).intent

    /**
     * Classifies the OAuth redirect [Intent] into success, user cancel, or a user-safe error.
     * Never log the returned [AuthorizationResponse] or raw intent extras (may contain codes).
     */
    fun parseAuthorizationResult(intent: Intent): OidcAuthorizationResult {
        val ex = AuthorizationException.fromIntent(intent)
        if (ex != null) {
            return authorizationExceptionToResult(ex)
        }
        val response = AuthorizationResponse.fromIntent(intent)
        if (response != null) {
            return OidcAuthorizationResult.Success(response)
        }
        return OidcAuthorizationResult.Error(msgGeneric())
    }

    /** Returns an [AuthorizationResponse] only when [parseAuthorizationResult] is [OidcAuthorizationResult.Success]. */
    fun parseAuthResponse(intent: Intent): AuthorizationResponse? =
        when (val result = parseAuthorizationResult(intent)) {
            is OidcAuthorizationResult.Success -> result.response
            else -> null
        }

    /**
     * Maps an OAuth redirect [Intent] to app-layer callback data without exposing AppAuth types to `:app`.
     */
    fun parseLoginCallback(intent: Intent): OidcLoginCallback {
        intent.data?.let { uri ->
            parseLoginCallbackFromRedirectUri(uri)?.let { return it }
        }
        return when (val result = parseAuthorizationResult(intent)) {
            is OidcAuthorizationResult.Success ->
                OidcLoginCallback.Success(
                    code = result.response.authorizationCode,
                    state = result.response.state,
                )
            is OidcAuthorizationResult.Canceled -> OidcLoginCallback.Canceled
            is OidcAuthorizationResult.Error -> OidcLoginCallback.Error(result.userMessage)
        }
    }

    fun parseLoginCallbackFromRedirectUri(uri: Uri): OidcLoginCallback? {
        if (!matchesConfiguredRedirect(uri)) return null
        val authError = uri.getQueryParameter("error")
        if (!authError.isNullOrBlank()) {
            val description = uri.getQueryParameter("error_description")
            val message = description?.takeIf { it.isNotBlank() } ?: msgGeneric()
            return OidcLoginCallback.Error(message)
        }
        val code = uri.getQueryParameter("code")
        if (!code.isNullOrBlank()) {
            return OidcLoginCallback.Success(code = code, state = uri.getQueryParameter("state"))
        }
        return null
    }

    private fun matchesConfiguredRedirect(candidate: Uri): Boolean {
        val redirect = MobileOAuthRedirectUris.toAppAuthUri(redirectUri)
        if (!candidate.scheme.equals(redirect.scheme, ignoreCase = true)) return false
        val expectedPath = MobileOAuthRedirectUris.pathKey(redirect)
        val actualPath = MobileOAuthRedirectUris.pathKey(candidate)
        return expectedPath.isNotEmpty() && expectedPath == actualPath
    }

    private fun buildAuthorizationRequest(
        authEndpoint: Uri,
        tokenEndpoint: Uri,
        redirectUri: Uri,
        scope: String,
        state: String,
        codeVerifier: String,
    ): AuthorizationRequest {
        val config = AuthorizationServiceConfiguration(authEndpoint, tokenEndpoint)
        return AuthorizationRequest.Builder(
            config,
            clientId,
            ResponseTypeValues.CODE,
            redirectUri,
        )
            .setScope(scope)
            .setState(state)
            .setCodeVerifier(codeVerifier)
            .build()
    }

    private fun createAuthorizationLaunchIntent(
        request: AuthorizationRequest,
        customTabsBrowserPackage: String?,
    ): Intent {
        val trimmedPackage = customTabsBrowserPackage?.trim().orEmpty()
        if (trimmedPackage.isEmpty()) {
            return authorizationService.getAuthorizationRequestIntent(request)
        }
        val customTabsIntent =
            authorizationService
                .createCustomTabsIntentBuilder(request.toUri())
                .build()
        customTabsIntent.intent.setPackage(trimmedPackage)
        return authorizationService.getAuthorizationRequestIntent(request, customTabsIntent)
    }

    private fun parseHttpEndpoint(raw: String, fieldName: String): Uri {
        val trimmed = raw.trim()
        require(trimmed.isNotEmpty()) { "$fieldName must not be blank" }
        val uri = Uri.parse(trimmed)
        val scheme = uri.scheme?.lowercase()
        require(scheme == "https" || scheme == "http") {
            "$fieldName must use http or https"
        }
        require(!uri.host.isNullOrBlank()) { "$fieldName must include a host" }
        return uri
    }

    private fun parseRedirectUri(raw: String): Uri {
        val trimmed = raw.trim()
        require(trimmed.contains(":")) { "redirect URI must include a scheme" }
        val uri = MobileOAuthRedirectUris.toAppAuthUri(trimmed)
        require(!uri.scheme.isNullOrBlank()) { "redirect URI scheme required" }
        return uri
    }

    private fun authorizationExceptionToResult(ex: AuthorizationException): OidcAuthorizationResult =
        when {
            ex == GeneralErrors.USER_CANCELED_AUTH_FLOW -> OidcAuthorizationResult.Canceled
            ex == GeneralErrors.PROGRAM_CANCELED_AUTH_FLOW -> OidcAuthorizationResult.Canceled
            ex == AuthorizationRequestErrors.ACCESS_DENIED -> OidcAuthorizationResult.Canceled
            ex == GeneralErrors.NETWORK_ERROR -> OidcAuthorizationResult.Error(msgNetwork())
            ex == GeneralErrors.SERVER_ERROR -> OidcAuthorizationResult.Error(msgServer())
            ex == GeneralErrors.INVALID_DISCOVERY_DOCUMENT -> OidcAuthorizationResult.Error(msgServer())
            ex == GeneralErrors.JSON_DESERIALIZATION_ERROR -> OidcAuthorizationResult.Error(msgServer())
            ex == AuthorizationRequestErrors.STATE_MISMATCH ->
                OidcAuthorizationResult.Error(msgStateMismatch())
            ex == AuthorizationRequestErrors.TEMPORARILY_UNAVAILABLE ->
                OidcAuthorizationResult.Error(msgTryLater())
            ex == AuthorizationRequestErrors.SERVER_ERROR -> OidcAuthorizationResult.Error(msgTryLater())
            ex.type == AuthorizationException.TYPE_OAUTH_TOKEN_ERROR ->
                OidcAuthorizationResult.Error(msgSession())
            else -> OidcAuthorizationResult.Error(msgGeneric())
        }

    companion object {
        private const val DEFAULT_CONNECT_TIMEOUT_MS = 15_000
        private const val DEFAULT_READ_TIMEOUT_MS = 15_000
        private const val DISCOVERY_DEADLINE_BUFFER_MS = 3_000L

        private fun discoveryMsg(context: Context, kind: DiscoveryMsg): String =
            when (kind) {
                DiscoveryMsg.Network -> context.getString(R.string.auth_oidc_network_error)
                DiscoveryMsg.Server -> context.getString(R.string.auth_oidc_server_unavailable)
                DiscoveryMsg.Generic -> context.getString(R.string.auth_oidc_generic_failed)
            }

        private enum class DiscoveryMsg { Network, Server, Generic }

        /**
         * Loads OIDC metadata from a discovery document URL with bounded connect/read timeouts.
         * On failure, returns a user-safe message (no URL or response body in the string).
         */
        suspend fun fetchConfigurationFromDiscoveryUrl(
            context: Context,
            discoveryUrl: String,
            connectTimeoutMs: Int = DEFAULT_CONNECT_TIMEOUT_MS,
            readTimeoutMs: Int = DEFAULT_READ_TIMEOUT_MS,
        ): OidcDiscoveryResult {
            val trimmed = discoveryUrl.trim()
            if (trimmed.isEmpty()) {
                return OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Generic))
            }
            val uri = Uri.parse(trimmed)
            if (uri.scheme.isNullOrBlank() || uri.host.isNullOrBlank()) {
                return OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Generic))
            }

            val deadlineMs = connectTimeoutMs + readTimeoutMs + DISCOVERY_DEADLINE_BUFFER_MS
            return try {
                withTimeout(deadlineMs) {
                    suspendCancellableCoroutine { cont ->
                        val connectionBuilder = TimeoutConnectionBuilder(connectTimeoutMs, readTimeoutMs)
                        AuthorizationServiceConfiguration.fetchFromUrl(
                            uri,
                            object : AuthorizationServiceConfiguration.RetrieveConfigurationCallback {
                                override fun onFetchConfigurationCompleted(
                                    serviceConfiguration: AuthorizationServiceConfiguration?,
                                    ex: AuthorizationException?,
                                ) {
                                    if (!cont.isActive) return
                                    val outcome =
                                        when {
                                            ex != null -> discoveryExceptionToResult(context, ex)
                                            serviceConfiguration != null ->
                                                OidcDiscoveryResult.Success(serviceConfiguration)
                                            else -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Generic))
                                        }
                                    cont.resume(outcome)
                                }
                            },
                            connectionBuilder,
                        )
                    }
                }
            } catch (_: TimeoutCancellationException) {
                OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Network))
            }
        }

        private fun discoveryExceptionToResult(context: Context, ex: AuthorizationException): OidcDiscoveryResult =
            when {
                ex == GeneralErrors.NETWORK_ERROR -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Network))
                ex == GeneralErrors.INVALID_DISCOVERY_DOCUMENT -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Server))
                ex == GeneralErrors.JSON_DESERIALIZATION_ERROR -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Server))
                ex == GeneralErrors.SERVER_ERROR -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Server))
                else -> OidcDiscoveryResult.Error(discoveryMsg(context, DiscoveryMsg.Generic))
            }

        private class TimeoutConnectionBuilder(
            private val connectTimeoutMs: Int,
            private val readTimeoutMs: Int,
        ) : ConnectionBuilder {
            override fun openConnection(uri: Uri): HttpURLConnection {
                val conn = DefaultConnectionBuilder.INSTANCE.openConnection(uri)
                conn.connectTimeout = connectTimeoutMs
                conn.readTimeout = readTimeoutMs
                return conn
            }
        }
    }
}

data class OidcLoginRequest(
    val intent: Intent,
    val authorizationUrl: String,
    val redirectUri: String,
    val state: String,
    val codeVerifier: String,
    val scope: String = "openid profile email",
)

sealed class OidcAuthorizationResult {
    data class Success(val response: AuthorizationResponse) : OidcAuthorizationResult()

    data object Canceled : OidcAuthorizationResult()

    data class Error(val userMessage: String) : OidcAuthorizationResult()
}

sealed class OidcLoginCallback {
    data class Success(val code: String?, val state: String?) : OidcLoginCallback()

    data object Canceled : OidcLoginCallback()

    data class Error(val userMessage: String) : OidcLoginCallback()
}

sealed class OidcDiscoveryResult {
    data class Success(val configuration: AuthorizationServiceConfiguration) : OidcDiscoveryResult()

    data class Error(val userMessage: String) : OidcDiscoveryResult()
}
