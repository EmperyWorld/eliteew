/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auth-aware OkHttp interceptors: bearer injection, proactive expiry refresh, 401 retry.
 *
 * Invariants:
 * - Internal auth-retry marker never leaves the app on the wire.
 *
 * Related:
 * - AuthRepository, NetworkFactory, SecureTokenStore
 */
package world.empery.mobile.core.network

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/** Provides the current access token for outbound API calls (may be empty if logged out). */
interface AccessTokenProvider {
    fun accessToken(): String?
}

/** Access token expiry epoch seconds from secure storage (null when unknown). */
interface TokenExpiryProvider {
    fun expiresAtEpochSeconds(): Long?
}

/**
 * Outcome of an access-token refresh attempt.
 *
 * Distinguishes auth rejection (session must end) from transient transport failures
 * (session stays alive; UI may show offline chrome).
 */
sealed interface AccessTokenRefreshResult {
    data class Success(val accessToken: String) : AccessTokenRefreshResult

    /** Refresh rejected (401/403), missing refresh token, or empty access token after refresh. */
    data object FailedAuth : AccessTokenRefreshResult

    /** Timeout / IOException / other transient transport failure — keep local session. */
    data object FailedTransient : AccessTokenRefreshResult
}

/** Refreshes the access token; implementations should persist the new token before returning. */
interface TokenRefresher {
    suspend fun refreshAccessToken(): String?

    /**
     * Preferred refresh entry for [UnauthorizedRetryInterceptor].
     * Default maps [refreshAccessToken] null → [AccessTokenRefreshResult.FailedAuth] (legacy callers).
     */
    suspend fun refreshAccessTokenDetailed(): AccessTokenRefreshResult {
        val token = refreshAccessToken()
        return if (token.isNullOrBlank()) {
            AccessTokenRefreshResult.FailedAuth
        } else {
            AccessTokenRefreshResult.Success(token)
        }
    }

    /** Invoked when an HTTP call is still unauthorized after refresh/retry is exhausted. */
    suspend fun onTerminalAuthFailure() {}

    /**
     * Invoked when token refresh failed due to transient network/timeout (not auth rejection).
     * Session must remain; UI may surface offline / reconnecting chrome.
     */
    suspend fun onTransientNetworkDuringRefresh() {}
}

/**
 * Attached to [Request] / [Response.request] when a call ends with an unrecoverable 401 after the
 * auth-aware stack has exhausted its single refresh + retry. Read via [Request.authAwareTerminal] /
 * [Response.authAwareTerminal].
 */
sealed interface AuthAwareTerminal {
    /** Refresh returned no usable access token (or implementation failed before updating storage). */
    data object RefreshFailed : AuthAwareTerminal

    /**
     * A new token was obtained (or another caller raced ahead with a fresher token) but this
     * request still received 401 on the single allowed retry.
     */
    data object StillUnauthorizedAfterRefresh : AuthAwareTerminal

    /**
     * Token refresh failed due to transient transport (timeout/IO); local session kept.
     * UI should prefer offline chrome over forced logout.
     */
    data object TransientNetworkDuringRefresh : AuthAwareTerminal
}

fun Request.authAwareTerminal(): AuthAwareTerminal? = tag(AuthAwareTerminal::class.java)

fun Response.authAwareTerminal(): AuthAwareTerminal? = request.authAwareTerminal()

private fun Response.withAuthAwareTerminal(terminal: AuthAwareTerminal): Response {
    val taggedRequest = request.newBuilder().tag(AuthAwareTerminal::class.java, terminal).build()
    return newBuilder().request(taggedRequest).build()
}

internal fun isTerminalAuthSensitivePath(path: String): Boolean =
    path == "/api/auth/refresh" ||
        path.startsWith("/api/v1/auth/") ||
        path.startsWith("/api/v1/gaf-chat/") ||
        path.startsWith("/api/v1/mobile-app/") ||
        path.startsWith("/api/v1/notification-center/") ||
        path.startsWith("/api/v1/profile/") ||
        path.startsWith("/api/v1/user-profile/")

/**
 * Internal marker stripped before the wire so it never leaves the app.
 * Used to avoid refresh loops and to coordinate with [BearerTokenInterceptor].
 */
private const val INTERNAL_AUTH_RETRY = "X-Empery-Internal-Auth-Retry"

/**
 * Single-flight coordinator for refresh work across [RefreshTokenAuthenticator] and
 * [UnauthorizedRetryInterceptor] in the same process (covers misconfiguration with both).
 */
private val authRefreshSingleFlight = Mutex()

/**
 * Adds `Authorization: Bearer …` on each application pass.
 * Strips [INTERNAL_AUTH_RETRY] so it is never sent to the origin.
 */

/**
 * Application interceptor: refresh access token before the request when expiry is within [skewSeconds].
 * Runs outermost among auth interceptors (before [BearerTokenInterceptor]).
 */
class ProactiveTokenRefreshInterceptor(
    private val tokenProvider: AccessTokenProvider,
    private val expiryProvider: TokenExpiryProvider,
    private val refresher: TokenRefresher,
    private val skewSeconds: Long = DEFAULT_PROACTIVE_REFRESH_SKEW_SECONDS,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider.accessToken()
        if (!token.isNullOrBlank()) {
            val expiresAt = expiryProvider.expiresAtEpochSeconds()
            if (expiresAt != null) {
                val now = System.currentTimeMillis() / 1000L
                if (expiresAt <= now + skewSeconds) {
                    runBlocking(Dispatchers.IO) {
                        authRefreshSingleFlight.withLock {
                            refresher.refreshAccessToken()
                        }
                    }
                }
            }
        }
        return chain.proceed(chain.request())
    }
}

class BearerTokenInterceptor(
    private val tokenProvider: AccessTokenProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val base = chain.request().newBuilder()
            .removeHeader(INTERNAL_AUTH_RETRY)
        val token = tokenProvider.accessToken()
        val request =
            if (token.isNullOrBlank()) {
                base.build()
            } else {
                base.header("Authorization", "Bearer $token").build()
            }
        return chain.proceed(request)
    }
}

/**
 * OkHttp [Authenticator] path for 401/407 challenges.
 *
 * **Concurrency:** refresh runs under a shared [Mutex] so parallel 401s serialize to one refresh.
 * **Deadlock:** if [TokenRefresher.refreshAccessToken] uses the **same** [OkHttpClient] (same
 * dispatcher) that triggered this authenticator, you can stall the connection pool. Implementations
 * should refresh via a dedicated short-timeout client or another stack without this authenticator.
 *
 * Prefer [UnauthorizedRetryInterceptor] + [AuthAwareHttp.configureAuthApplicationInterceptors] when
 * you control client construction (interceptor ordering: retry outer, bearer inner).
 */
class RefreshTokenAuthenticator(
    private val refresher: TokenRefresher,
    private val tokenProvider: AccessTokenProvider? = null,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): okhttp3.Request? {
        if (responseCount(response) >= 2) return null

        val attemptedBearer =
            response.request.header("Authorization")
                ?.removePrefix("Bearer")
                ?.trim()
        val newToken =
            runBlocking(Dispatchers.IO) {
                authRefreshSingleFlight.withLock {
                    val current = tokenProvider?.accessToken()?.takeIf { it.isNotBlank() }
                    if (current != null &&
                        attemptedBearer != null &&
                        current != attemptedBearer
                    ) {
                        current
                    } else {
                        refresher.refreshAccessToken()
                    }
                }
            } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var current: Response? = response
        var count = 1
        while (current?.priorResponse != null) {
            count += 1
            current = current.priorResponse
        }
        return count
    }
}

/**
 * Application interceptor: on HTTP 401, runs a single-flight [TokenRefresher] and retries once.
 *
 * **Ordering:** register **before** [BearerTokenInterceptor] (outer in the application chain) so
 * each retry runs through the bearer again and picks up the new token:
 * `addInterceptor(UnauthorizedRetryInterceptor(...)); addInterceptor(BearerTokenInterceptor(...))`.
 *
 * The retry request is always marked with [INTERNAL_AUTH_RETRY] so a second 401 cannot trigger
 * another refresh (no infinite loops even if the new token is still rejected).
 *
 * Terminal 401 responses may carry [AuthAwareTerminal] on [Response.request]; see
 * [Response.authAwareTerminal].
 *
 * Do not combine with [RefreshTokenAuthenticator] on the same client (double refresh / confusing loops).
 */
class UnauthorizedRetryInterceptor(
    private val tokenProvider: AccessTokenProvider,
    private val refresher: TokenRefresher,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val alreadyRetried = request.header(INTERNAL_AUTH_RETRY) == "1"
        val tokenSeenBefore = tokenProvider.accessToken()

        var response = chain.proceed(request)
        if (response.code != 401 || alreadyRetried) {
            return response
        }

        response.close()

        val refreshOutcome =
            runBlocking(Dispatchers.IO) {
                authRefreshSingleFlight.withLock {
                    val now = tokenProvider.accessToken()?.takeIf { it.isNotBlank() }
                    if (now != null &&
                        tokenSeenBefore != null &&
                        now != tokenSeenBefore
                    ) {
                        RefreshOutcome.TokenUpdatedByPeer
                    } else {
                        when (refresher.refreshAccessTokenDetailed()) {
                            is AccessTokenRefreshResult.Success -> RefreshOutcome.Refreshed
                            AccessTokenRefreshResult.FailedTransient -> RefreshOutcome.TransientNetwork
                            AccessTokenRefreshResult.FailedAuth -> RefreshOutcome.RefreshFailed
                        }
                    }
                }
            }

        if (refreshOutcome is RefreshOutcome.TransientNetwork) {
            runBlocking(Dispatchers.IO) { refresher.onTransientNetworkDuringRefresh() }
            // Do not force logout; return a tagged 401 without a second auth-sensitive terminal path.
            val tagged =
                request.newBuilder()
                    .removeHeader(INTERNAL_AUTH_RETRY)
                    .header(INTERNAL_AUTH_RETRY, "1")
                    .tag(AuthAwareTerminal::class.java, AuthAwareTerminal.TransientNetworkDuringRefresh)
                    .build()
            return chain.proceed(tagged).withAuthAwareTerminal(AuthAwareTerminal.TransientNetworkDuringRefresh)
        }

        val retryBase =
            request.newBuilder()
                .removeHeader(INTERNAL_AUTH_RETRY)
                .header(INTERNAL_AUTH_RETRY, "1")

        val retryResponse = chain.proceed(retryBase.build())
        val terminalSensitive = isTerminalAuthSensitivePath(request.url.encodedPath)
        if (!terminalSensitive) return retryResponse

        return when {
            retryResponse.code != 401 -> retryResponse
            refreshOutcome is RefreshOutcome.RefreshFailed -> {
                runBlocking(Dispatchers.IO) { refresher.onTerminalAuthFailure() }
                retryResponse.withAuthAwareTerminal(AuthAwareTerminal.RefreshFailed)
            }
            else -> {
                runBlocking(Dispatchers.IO) { refresher.onTerminalAuthFailure() }
                retryResponse.withAuthAwareTerminal(AuthAwareTerminal.StillUnauthorizedAfterRefresh)
            }
        }
    }

    private sealed interface RefreshOutcome {
        data object TokenUpdatedByPeer : RefreshOutcome

        data object Refreshed : RefreshOutcome

        data object RefreshFailed : RefreshOutcome

        data object TransientNetwork : RefreshOutcome
    }
}

/**
 * Factory helpers and defaults for an auth-aware OkHttp stack.
 *
 * **Interceptor order (application):** optional logging (outermost) →
 * [UnauthorizedRetryInterceptor] → [BearerTokenInterceptor] → rest.
 */
/** Skew window for proactive refresh (seconds before expiry). */
const val DEFAULT_PROACTIVE_REFRESH_SKEW_SECONDS = 60L

object AuthAwareHttp {
    const val DEFAULT_CONNECT_TIMEOUT_SECONDS: Long = 15L
    const val DEFAULT_READ_TIMEOUT_SECONDS: Long = 30L
    const val DEFAULT_WRITE_TIMEOUT_SECONDS: Long = 30L
    const val DEFAULT_CALL_TIMEOUT_SECONDS: Long = 60L

    /** Sensible production timeouts; does not add interceptors. */
    fun applySensibleTimeouts(builder: OkHttpClient.Builder): OkHttpClient.Builder =
        builder
            .connectTimeout(DEFAULT_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(DEFAULT_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(DEFAULT_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .callTimeout(DEFAULT_CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)

    /**
     * 401 retry (outer) + bearer (inner). No [Authenticator].
     * Use when refresh does not share this client’s connection pool / dispatcher.
     */
    fun configureAuthApplicationInterceptors(
        builder: OkHttpClient.Builder,
        tokenProvider: AccessTokenProvider,
        expiryProvider: TokenExpiryProvider,
        tokenRefresher: TokenRefresher,
        skewSeconds: Long = DEFAULT_PROACTIVE_REFRESH_SKEW_SECONDS,
    ): OkHttpClient.Builder =
        builder
            .addInterceptor(
                ProactiveTokenRefreshInterceptor(tokenProvider, expiryProvider, tokenRefresher, skewSeconds),
            )
            .addInterceptor(UnauthorizedRetryInterceptor(tokenProvider, tokenRefresher))
            .addInterceptor(BearerTokenInterceptor(tokenProvider))

    fun configureAuthApplicationInterceptors(
        builder: OkHttpClient.Builder,
        tokenProvider: AccessTokenProvider,
        tokenRefresher: TokenRefresher,
    ): OkHttpClient.Builder =
        configureAuthApplicationInterceptors(
            builder,
            tokenProvider,
            expiryProvider = object : TokenExpiryProvider {
                override fun expiresAtEpochSeconds(): Long? = null
            },
            tokenRefresher = tokenRefresher,
        )

    /** Full client with timeouts + auth interceptors (no authenticator). */
    fun newClient(
        tokenProvider: AccessTokenProvider,
        tokenRefresher: TokenRefresher,
        configure: OkHttpClient.Builder.() -> Unit = {},
    ): OkHttpClient {
        val base =
            configureAuthApplicationInterceptors(
                applySensibleTimeouts(OkHttpClient.Builder()),
                tokenProvider,
                tokenRefresher,
            )
        return base.apply(configure).build()
    }
}
