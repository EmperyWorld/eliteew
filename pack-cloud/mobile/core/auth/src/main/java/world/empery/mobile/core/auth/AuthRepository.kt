/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile SSO session: token exchange, proactive refresh, backend logout, and secure storage.
 *
 * Invariants:
 * - Refresh and logout are serialized under a single mutex; never log tokens or codes.
 * - Persisted access tokens must carry azp=[expectedOidcClientId] (empery-mobile), never web.
 *
 * Related:
 * - SecureTokenStore, AuthApi, MobileAccessTokenClientGuard, ProactiveTokenRefreshInterceptor, MainViewModel
 */
package world.empery.mobile.core.auth

import android.util.Log
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import world.empery.mobile.core.network.AccessTokenRefreshResult
import world.empery.mobile.core.network.TokenRefresher
import world.empery.mobile.core.network.api.AuthApi
import world.empery.mobile.core.network.api.SsoCallbackRequest
import world.empery.mobile.core.network.api.SsoLogoutRequest
import world.empery.mobile.core.network.api.TokenRefreshRequest
import kotlin.time.Duration.Companion.seconds

enum class SessionReconcileResult {
    NoSession,
    Refreshed,
    KeptDespiteTransientFailure,
    ClearedInvalidSession,
}

enum class AuthTerminationReason {
    SessionReplaced,
    RefreshRejected,
}

data class SpaOidcBootstrapTokens(
    val accessToken: String,
    val refreshToken: String,
)

class AuthRepository(
    private val authApi: AuthApi,
    private val tokenStore: SecureTokenStore,
    private val expectedOidcClientId: String = "",
) : TokenRefresher {

    /** Optional hook for Socket.IO rebuild after silent HTTP token refresh. */
    @Volatile
    var onAccessTokenRefreshed: ((String) -> Unit)? = null

    /** Invoked when refresh rejects the session (e.g. SSO session replaced on another device). */
    @Volatile
    var onSessionTerminated: ((AuthTerminationReason) -> Unit)? = null

    /**
     * Invoked when access-token refresh fails due to transient transport (timeout/IO).
     * Session stays; UI may show offline chrome.
     */
    @Volatile
    var onTransientRefreshNetworkError: (() -> Unit)? = null

    private val refreshMutex = Mutex()
    private val sessionTerminated = AtomicBoolean(false)
    private val confirmReplaceOnNextExchange = AtomicBoolean(false)
    private var pendingLoginState: String? = null
    private var pendingCodeVerifier: String? = null
    private var pendingRedirectUri: String? = null

    init {
        if (tokenStore.recoveredEmptyAfterCorruption) {
            Log.w(TAG, "secure token store recovered empty after corruption; force re-login")
            sessionTerminated.set(true)
        } else {
            discardWrongClientSessionIfNeeded(reason = "init")
        }
    }

    fun hasSession(): Boolean {
        if (tokenStore.accessToken()?.isNotBlank() != true) return false
        if (tokenStore.refreshToken()?.isNotBlank() != true) return false
        return isAccessTokenClientAllowed(tokenStore.accessToken().orEmpty())
    }

    /** Access + refresh for SPA WebView bootstrap (empery-mobile OIDC bundle). */
    fun readSpaOidcBootstrapTokens(): SpaOidcBootstrapTokens? {
        val access = tokenStore.accessToken()?.takeIf { it.isNotBlank() } ?: return null
        val refresh = tokenStore.refreshToken()?.takeIf { it.isNotBlank() } ?: return null
        return SpaOidcBootstrapTokens(accessToken = access, refreshToken = refresh)
    }


    /**
     * After APK upgrade: drop zombie sessions (access without refresh) and force one token refresh
     * so HTTP/Socket.IO do not keep serving a stale access token until manual app-data wipe.
     */
    suspend fun reconcileSessionAfterAppUpgrade(): SessionReconcileResult {
        val access = tokenStore.accessToken()?.takeIf { it.isNotBlank() }
        if (access == null) return SessionReconcileResult.NoSession
        if (!isAccessTokenClientAllowed(access)) {
            Log.w(TAG, "reconcileSessionAfterAppUpgrade: access token azp is not mobile client; clearing")
            logoutLocalOnly()
            return SessionReconcileResult.ClearedInvalidSession
        }
        val refresh = tokenStore.refreshToken()?.takeIf { it.isNotBlank() }
        if (refresh == null) {
            Log.w(TAG, "reconcileSessionAfterAppUpgrade: missing refresh token; clearing local session")
            logoutLocalOnly()
            return SessionReconcileResult.ClearedInvalidSession
        }
        val refreshed = refreshAccessToken()
        return when {
            refreshed != null -> SessionReconcileResult.Refreshed
            !hasSession() -> SessionReconcileResult.ClearedInvalidSession
            else -> SessionReconcileResult.KeptDespiteTransientFailure
        }
    }

    fun currentAccessToken(): String? = tokenStore.accessToken()

    fun accessTokenExpiryEpochSeconds(): Long? = tokenStore.expiresAtEpochSeconds()

    fun isAccessTokenExpiringWithin(skewSeconds: Long = DEFAULT_EXPIRY_SKEW_SECONDS): Boolean {
        val expiresAt = tokenStore.expiresAtEpochSeconds() ?: return false
        val now = System.currentTimeMillis() / 1000L
        return expiresAt <= now + skewSeconds
    }

    fun setPendingLogin(state: String, codeVerifier: String, redirectUri: String) {
        pendingLoginState = state
        pendingCodeVerifier = codeVerifier
        pendingRedirectUri = MobileOAuthRedirectUris.canonicalize(redirectUri)
    }

    /** Clears terminal logout flag before a fresh OAuth attempt. */
    fun beginNewLoginAttempt() {
        sessionTerminated.set(false)
    }

    /** After user confirms SSO session replace, send header on the next callback exchange only. */
    fun markReplaceConfirmForNextExchange() {
        confirmReplaceOnNextExchange.set(true)
    }

    fun dismissReplaceConfirmForNextExchange() {
        confirmReplaceOnNextExchange.set(false)
    }

    /**
     * Proactive refresh before outbound HTTP when the access token is within [skewSeconds] of expiry.
     */
    suspend fun ensureFreshAccessToken(skewSeconds: Long = DEFAULT_EXPIRY_SKEW_SECONDS): String? {
        val current = tokenStore.accessToken()?.takeIf { it.isNotBlank() } ?: return null
        if (!isAccessTokenExpiringWithin(skewSeconds)) return current
        return refreshAccessToken()
    }

    suspend fun exchangeAuthorizationCode(
        code: String,
        state: String?,
        redirectUri: String,
    ): Boolean = refreshMutex.withLock {
        sessionTerminated.set(false)
        require(code.isNotBlank()) { "authorization code must not be blank" }
        require(redirectUri.isNotBlank()) { "redirect URI must not be blank" }

        val expectedState = pendingLoginState
        if (!expectedState.isNullOrBlank() && state != expectedState) {
            clearPendingLogin()
            throw IllegalStateException("SSO state mismatch")
        }
        val codeVerifier = pendingCodeVerifier ?: throw IllegalStateException("Missing PKCE code_verifier")
        val wireRedirectUri =
            pendingRedirectUri?.takeIf { it.isNotBlank() }
                ?: MobileOAuthRedirectUris.canonicalize(redirectUri)

        try {
            val replaceHeader =
                if (confirmReplaceOnNextExchange.getAndSet(false)) {
                    "1"
                } else {
                    null
                }
            val response = authApi.ssoCallback(
                SsoCallbackRequest(
                    code = code,
                    state = state,
                    redirect_uri = wireRedirectUri,
                    code_verifier = codeVerifier,
                ),
                replaceConfirm = replaceHeader,
            )
            val tokens = response.tokens
            val access = tokens.access_token.takeIf { it.isNotBlank() }
                ?: run {
                    logExchangeFailure(IllegalStateException("missing access_token in SSO response"))
                    throw IllegalStateException("SSO response missing access_token")
                }
            val refresh = tokens.refresh_token.takeIf { it.isNotBlank() }
                ?: run {
                    logExchangeFailure(IllegalStateException("missing refresh_token in SSO response"))
                    throw IllegalStateException("SSO response missing refresh_token")
                }
            val expiresInSeconds = tokens.expires_in.toLong().coerceAtLeast(0L)
            val expiresAt = (System.currentTimeMillis() / 1000L) + expiresInSeconds.seconds.inWholeSeconds
            if (sessionTerminated.get()) {
                Log.w(TAG, "SSO exchange succeeded after logout; discarding tokens")
                clearPendingLogin()
                return false
            }
            persistTokens(
                TokenBundle(
                    accessToken = access,
                    refreshToken = refresh,
                    expiresAtEpochSeconds = expiresAt,
                ),
            )
            clearPendingLogin()
            return true
        } catch (error: Throwable) {
            when {
                error is SecurityStorageException -> {
                    forceLogoutOnStorageFailure(error)
                    throw error
                }
                error is CancellationException -> throw error
                error is IOException -> {
                    Log.w(TAG, "SSO exchange failed: network error (${error.javaClass.simpleName})")
                    throw error
                }
                isRetrofitHttpException(error) -> {
                    val httpCode = retrofitHttpCode(error)
                    val reason = retrofitHttpErrorBody(error)?.let(AuthErrorParser::parseReason)
                    if (httpCode == 409 && reason == AuthErrorParser.REASON_SESSION_REPLACE_CONFIRMATION_REQUIRED) {
                        clearPendingLogin()
                        throw SsoExchangeConfirmationRequiredException()
                    }
                    if (httpCode != null) {
                        logExchangeHttpFailure(httpCode)
                        if (httpCode in CLIENT_ERROR_RANGE) {
                            clearPendingLogin()
                        }
                        if (reason != null || httpCode in CLIENT_ERROR_RANGE) {
                            throw SsoExchangeException(
                                reason = reason,
                                message = "SSO exchange HTTP $httpCode",
                            )
                        }
                    } else {
                        Log.w(TAG, "SSO exchange failed: HTTP error (code unavailable)")
                        clearPendingLogin()
                    }
                    throw error
                }
                error is Exception -> {
                    logExchangeFailure(error)
                    throw error
                }
                else -> throw error
            }
        }
    }

    override suspend fun refreshAccessToken(): String? =
        when (val result = refreshAccessTokenDetailed()) {
            is AccessTokenRefreshResult.Success -> result.accessToken
            AccessTokenRefreshResult.FailedAuth,
            AccessTokenRefreshResult.FailedTransient,
            -> null
        }

    override suspend fun refreshAccessTokenDetailed(): AccessTokenRefreshResult = refreshMutex.withLock {
        if (sessionTerminated.get()) {
            return AccessTokenRefreshResult.FailedAuth
        }
        val refreshToken = tokenStore.refreshToken()?.takeIf { it.isNotBlank() }
            ?: return AccessTokenRefreshResult.FailedAuth
        return try {
            val response =
                withTimeout(REFRESH_TIMEOUT_MS) {
                    authApi.refresh(TokenRefreshRequest(refreshToken))
                }
            val access = response.access_token.takeIf { it.isNotBlank() }
            if (access == null) {
                Log.w(TAG, "refreshAccessToken: empty access_token in response; clearing session")
                tokenStore.clear()
                notifySessionTerminated(AuthTerminationReason.RefreshRejected)
                return AccessTokenRefreshResult.FailedAuth
            }
            val nextRefresh = response.refresh_token.takeIf { it.isNotBlank() } ?: refreshToken
            val expiresInSeconds = response.expires_in.toLong().coerceAtLeast(0L)
            val expiresAt = (System.currentTimeMillis() / 1000L) + expiresInSeconds.seconds.inWholeSeconds
            if (sessionTerminated.get()) {
                Log.w(TAG, "refreshAccessToken: logout during refresh; not persisting new tokens")
                return AccessTokenRefreshResult.FailedAuth
            }
            persistTokens(
                TokenBundle(
                    accessToken = access,
                    refreshToken = nextRefresh,
                    expiresAtEpochSeconds = expiresAt,
                ),
            )
            onAccessTokenRefreshed?.invoke(access)
            AccessTokenRefreshResult.Success(access)
        } catch (error: Throwable) {
            when {
                error is SecurityStorageException -> {
                    forceLogoutOnStorageFailure(error)
                    AccessTokenRefreshResult.FailedAuth
                }
                error is IllegalStateException -> {
                    Log.w(TAG, "refreshAccessToken: rejected token client (${error.message})")
                    runCatching { tokenStore.clear() }
                    notifySessionTerminated(AuthTerminationReason.RefreshRejected)
                    AccessTokenRefreshResult.FailedAuth
                }
                error is TimeoutCancellationException -> {
                    Log.w(TAG, "refreshAccessToken: timed out after ${REFRESH_TIMEOUT_MS}ms")
                    AccessTokenRefreshResult.FailedTransient
                }
                error is CancellationException -> throw error
                error is IOException -> {
                    Log.w(TAG, "refreshAccessToken: transient network error (${error.javaClass.simpleName})")
                    AccessTokenRefreshResult.FailedTransient
                }
                isRetrofitHttpException(error) -> {
                    val code = retrofitHttpCode(error)
                    if (code != null) {
                        logRefreshHttpFailure(code)
                        if (shouldClearStoredSessionOnRefreshFailure(code)) {
                            val reason = retrofitHttpErrorBody(error)?.let(AuthErrorParser::parseReason)
                            if (reason == AuthErrorParser.REASON_SESSION_REPLACED) {
                                notifySessionTerminated(AuthTerminationReason.SessionReplaced)
                            } else if (code == 401 || code == 403) {
                                notifySessionTerminated(AuthTerminationReason.RefreshRejected)
                            }
                            tokenStore.clear()
                            AccessTokenRefreshResult.FailedAuth
                        } else {
                            // 5xx / 408 / 429 — keep session; treat as transport-ish deferral
                            AccessTokenRefreshResult.FailedTransient
                        }
                    } else {
                        Log.w(TAG, "refreshAccessToken failed: HTTP error (code unavailable)")
                        AccessTokenRefreshResult.FailedTransient
                    }
                }
                else -> {
                    Log.w(TAG, "refreshAccessToken failed: ${error.javaClass.simpleName}")
                    AccessTokenRefreshResult.FailedTransient
                }
            }
        }
    }

    override suspend fun onTerminalAuthFailure() {
        refreshMutex.withLock {
            if (sessionTerminated.get()) return
            if (!hasSession()) return
            Log.i(TAG, "terminal auth failure: clearing session and requesting re-login")
            tokenStore.clear()
            notifySessionTerminated(AuthTerminationReason.RefreshRejected)
        }
    }

    override suspend fun onTransientNetworkDuringRefresh() {
        Log.i(TAG, "transient network during token refresh; keeping session")
        runCatching { onTransientRefreshNetworkError?.invoke() }
    }

    /**
     * Best-effort Keycloak/API logout, then always clears local tokens.
     */
    suspend fun logoutWithBackend() {
        refreshMutex.withLock {
            sessionTerminated.set(true)
            clearPendingLogin()
            val refreshToken = tokenStore.refreshToken()?.takeIf { it.isNotBlank() }
            if (!refreshToken.isNullOrBlank()) {
                runCatching { authApi.ssoLogout(SsoLogoutRequest(refresh_token = refreshToken)) }
                    .onFailure { err ->
                        if (err !is CancellationException) {
                            Log.w(TAG, "Backend SSO logout failed (${err.javaClass.simpleName})")
                        }
                    }
            }
            tokenStore.clear()
        }
    }

    fun logoutLocalOnly() {
        sessionTerminated.set(true)
        clearPendingLogin()
        tokenStore.clear()
    }

    /** @deprecated Use [logoutWithBackend] or [logoutLocalOnly]. */
    fun logout() {
        logoutLocalOnly()
    }

    private fun notifySessionTerminated(reason: AuthTerminationReason) {
        sessionTerminated.set(true)
        runCatching { onSessionTerminated?.invoke(reason) }
    }

    private fun persistTokens(bundle: TokenBundle) {
        if (!isAccessTokenClientAllowed(bundle.accessToken)) {
            val azp = MobileAccessTokenClientGuard.azpClaim(bundle.accessToken)
            Log.e(
                TAG,
                "refusing to persist access token with azp=${azp ?: "missing"}; expected=$expectedOidcClientId",
            )
            throw IllegalStateException("SSO access token client is not empery-mobile")
        }
        try {
            tokenStore.save(bundle)
        } catch (e: SecurityStorageException) {
            forceLogoutOnStorageFailure(e)
            throw e
        }
    }

    private fun isAccessTokenClientAllowed(accessToken: String): Boolean =
        MobileAccessTokenClientGuard.isAllowedMobileAccessToken(
            accessToken = accessToken,
            expectedClientId = expectedOidcClientId,
        )

    private fun discardWrongClientSessionIfNeeded(reason: String) {
        val access = tokenStore.accessToken()?.takeIf { it.isNotBlank() } ?: return
        if (isAccessTokenClientAllowed(access)) return
        Log.w(TAG, "discarding stored session with non-mobile azp ($reason)")
        runCatching { tokenStore.clear() }
        sessionTerminated.set(true)
    }

    private fun forceLogoutOnStorageFailure(error: SecurityStorageException) {
        Log.e(TAG, "secure storage failure; force logout", error)
        runCatching { tokenStore.clear() }
        notifySessionTerminated(AuthTerminationReason.RefreshRejected)
    }

    private fun clearPendingLogin() {
        pendingLoginState = null
        pendingCodeVerifier = null
        pendingRedirectUri = null
    }

    private fun logRefreshHttpFailure(code: Int) {
        when (code) {
            in 500..599 -> Log.w(TAG, "refreshAccessToken failed: server HTTP $code")
            401, 403 -> Log.w(TAG, "refreshAccessToken failed: session rejected (HTTP $code)")
            in 400..499 -> Log.w(TAG, "refreshAccessToken failed: client HTTP $code")
            else -> Log.w(TAG, "refreshAccessToken failed: HTTP $code")
        }
    }

    private fun logExchangeHttpFailure(code: Int) {
        when (code) {
            in 500..599 -> Log.w(TAG, "SSO exchange failed: server HTTP $code")
            in 400..499 -> Log.w(TAG, "SSO exchange failed: client HTTP $code")
            else -> Log.w(TAG, "SSO exchange failed: HTTP $code")
        }
    }

    private fun logExchangeFailure(error: Throwable) {
        Log.w(TAG, "SSO exchange: invalid response (${error.javaClass.simpleName})")
    }

    private fun shouldClearStoredSessionOnRefreshFailure(code: Int): Boolean {
        if (code in 500..599) return false
        if (code == 408 || code == 429) return false
        if (code in 400..499) return true
        return false
    }

    private fun isRetrofitHttpException(error: Throwable): Boolean =
        error.javaClass.name == RETROFIT_HTTP_EXCEPTION_CLASS

    private fun retrofitHttpCode(error: Throwable): Int? {
        if (!isRetrofitHttpException(error)) return null
        return runCatching {
            val method = error.javaClass.methods.firstOrNull { candidate ->
                candidate.name == "code" && candidate.parameterCount == 0
            } ?: return null
            (method.invoke(error) as? Number)?.toInt()
        }.getOrNull()
    }

    private fun retrofitHttpErrorBody(error: Throwable): String? {
        if (!isRetrofitHttpException(error)) return null
        return runCatching {
            val responseMethod = error.javaClass.methods.firstOrNull { it.name == "response" && it.parameterCount == 0 }
                ?: return null
            val response = responseMethod.invoke(error) ?: return null
            val errorBodyMethod = response.javaClass.methods.firstOrNull { it.name == "errorBody" && it.parameterCount == 0 }
                ?: return null
            val errorBody = errorBodyMethod.invoke(response) ?: return null
            val stringMethod = errorBody.javaClass.methods.firstOrNull { it.name == "string" && it.parameterCount == 0 }
                ?: return null
            stringMethod.invoke(errorBody) as? String
        }.getOrNull()
    }

    companion object {
        private const val TAG = "AuthRepository"
        private const val RETROFIT_HTTP_EXCEPTION_CLASS = "retrofit2.HttpException"
        private const val REFRESH_TIMEOUT_MS = 15_000L
        private val CLIENT_ERROR_RANGE = 400..499
        const val DEFAULT_EXPIRY_SKEW_SECONDS = 60L
    }
}
