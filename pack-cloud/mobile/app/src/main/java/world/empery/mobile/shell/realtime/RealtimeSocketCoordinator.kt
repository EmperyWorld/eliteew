/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Socket.IO connect lifecycle, debounce, bridge ownership, and auth recovery (MA-02.2).
 *
 * Invariants:
 * - Chat event mutation stays in ChatRealtimeEventReducer; host applies effects.
 *
 * Related:
 * - MainViewModel, RealtimeChatBridge, ChatRealtimeEventReducer
 */
package world.empery.mobile.shell.realtime

import android.os.SystemClock
import android.util.Log
import feature.chat.RealtimeChatBridge
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import world.empery.mobile.core.auth.AuthErrorParser
import world.empery.mobile.core.network.MobileNetworkFailureSupport
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.observability.MobileTelemetry

internal object RealtimeSocketConstants {
    const val TAG = "RealtimeSocketCoordinator"
    const val CONNECT_MIN_INTERVAL_MS = 1_500L
}

internal val KNOWN_REALTIME_AUTH_REASONS =
    setOf(
        AuthErrorParser.REASON_SESSION_REPLACED,
        AuthErrorParser.REASON_TOKEN_EXPIRED,
        AuthErrorParser.REASON_INVALID_TOKEN,
        "token_missing",
        "forbidden",
        "authentication_failed",
        "session_replace_confirmation_required",
    )

/** Side-effect hooks; MainViewModel implements chat reduce + legacy video/auth paths. */
interface RealtimeSocketEventHost {
    fun isAuthenticated(): Boolean

    fun shouldDeferPrivateTunnel(): Boolean

    fun isAppInForeground(): Boolean

    fun hasActiveRealtimeSession(): Boolean

    suspend fun ensureFreshAccessToken()

    fun resolveSocketBaseUrl(): String

    fun currentAccessToken(): String?

    fun onSocketConnected()

    fun onMessageNew(payload: JSONObject)

    fun onMessageRead(payload: JSONObject)

    fun onMessageEdited(payload: JSONObject)

    fun onMessageDeleted(payload: JSONObject)

    fun onChatCreated()

    fun onE2eeConsentChanged(payload: JSONObject)

    fun onNotification(payload: JSONObject)

    fun onVideoCallIncoming(payload: JSONObject)

    fun onVideoCallAccepted(payload: JSONObject)

    fun onVideoCallEnded(payload: JSONObject)

    fun onNonAuthConnectionError(error: Throwable)

    suspend fun onSessionReplacedLogout()

    /** @return true when token refresh succeeded and reconnect was scheduled */
    suspend fun tryAuthRefreshAndReconnect(): Boolean

    suspend fun onTerminalAuthFailure()

    fun onHeuristicTransientAuthError(error: Throwable)
}

class RealtimeSocketCoordinator(
    private val scope: CoroutineScope,
    private val socketLifecycleState: MutableStateFlow<SocketLifecycleState>,
    private val host: RealtimeSocketEventHost,
) {
    private var bridge: RealtimeChatBridge? = null
    private var bridgeToken: String? = null
    private var connectJob: Job? = null
    private var lastConnectAttemptAtMs: Long = 0L
    private var authRecoveryJob: Job? = null
    private var authRecoveryAttempted: Boolean = false

    fun connectIfAllowed() {
        if (!host.isAuthenticated()) return
        if (host.shouldDeferPrivateTunnel()) {
            socketLifecycleState.value = SocketLifecycleState.Disconnected
            return
        }
        if (!host.isAppInForeground() && !host.hasActiveRealtimeSession()) return
        if (connectJob?.isActive == true) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastConnectAttemptAtMs < RealtimeSocketConstants.CONNECT_MIN_INTERVAL_MS) {
            Log.i(RealtimeSocketConstants.TAG, "Realtime connect debounced after network transition")
            return
        }
        lastConnectAttemptAtMs = now
        connectJob =
            scope.launch {
                try {
                    if (!host.isAuthenticated()) return@launch
                    host.ensureFreshAccessToken()
                    if (!host.isAuthenticated()) return@launch
                    val activeBridge = ensureBridge() ?: return@launch
                    activeBridge.connect(
                        onLifecycleStateChanged = { next ->
                            socketLifecycleState.value = next
                            if (next == SocketLifecycleState.Connected) {
                                resetAuthRecoveryAttempt()
                                host.onSocketConnected()
                            }
                        },
                        onMessageNew = host::onMessageNew,
                        onMessageRead = host::onMessageRead,
                        onMessageEdited = host::onMessageEdited,
                        onMessageDeleted = host::onMessageDeleted,
                        onChatCreated = { host.onChatCreated() },
                        onE2eeConsentChanged = host::onE2eeConsentChanged,
                        onNotification = host::onNotification,
                        onVideoCallIncoming = host::onVideoCallIncoming,
                        onConnectionError = ::handleConnectionError,
                        onVideoCallEnded = host::onVideoCallEnded,
                        onVideoCallAccepted = host::onVideoCallAccepted,
                    )
                } catch (err: CancellationException) {
                    throw err
                } catch (err: Throwable) {
                    if (MobileNetworkFailureSupport.isTransientNetworkFailure(err)) {
                        Log.w(RealtimeSocketConstants.TAG, "[STEP] realtime_connect_network_degrade", err)
                        MobileTelemetry.reportError(err, "realtime_connect_network_degrade")
                        socketLifecycleState.value = SocketLifecycleState.Disconnected
                    } else {
                        MobileTelemetry.reportError(err, "realtime_connect_failed")
                        Log.e(RealtimeSocketConstants.TAG, "realtime connect failed", err)
                    }
                } finally {
                    connectJob = null
                }
            }
    }

    fun cancelConnectJob() {
        connectJob?.cancel()
        connectJob = null
    }

    fun clearAuthRecoveryState() {
        authRecoveryJob?.cancel()
        authRecoveryJob = null
        authRecoveryAttempted = false
    }

    fun resetAuthRecoveryAttempt() {
        authRecoveryAttempted = false
        if (authRecoveryJob?.isCompleted == true) {
            authRecoveryJob = null
        }
    }

    fun invalidateBridgeAndReconnect() {
        if (!host.isAuthenticated()) return
        releaseBridge()
        connectIfAllowed()
    }

    fun releaseBridge() {
        bridge?.release()
        bridge = null
        bridgeToken = null
        socketLifecycleState.value = SocketLifecycleState.Disconnected
    }

    fun ensureBridge(): RealtimeChatBridge? {
        val token = host.currentAccessToken() ?: return null
        if (bridge != null && bridgeToken == token) {
            return bridge
        }
        bridge?.release()
        bridge = null
        bridgeToken = null
        val socketBase =
            host.resolveSocketBaseUrl().substringBefore("/api/").ifBlank {
                host.resolveSocketBaseUrl().trimEnd('/')
            }
        val created =
            RealtimeChatBridge(
                socketBaseUrl = socketBase,
                bearerToken = token,
            )
        bridge = created
        bridgeToken = token
        return created
    }

    private fun handleConnectionError(error: Throwable) {
        if (isAuthRelatedRealtimeError(error)) {
            handleAuthConnectionError(error)
            return
        }
        host.onNonAuthConnectionError(error)
    }

    private fun handleAuthConnectionError(error: Throwable) {
        if (authRecoveryJob?.isActive == true) return
        authRecoveryJob =
            scope.launch {
                val reason = realtimeAuthReason(error)
                runCatching {
                    MobileTelemetry.trackBusinessEvent(
                        "realtime_auth_error",
                        mapOf("reason" to (reason ?: "heuristic")),
                    )
                }
                if (reason == AuthErrorParser.REASON_SESSION_REPLACED) {
                    runCatching {
                        MobileTelemetry.trackBusinessEvent(
                            "realtime_auth_recovery",
                            mapOf("result" to "session_replaced_logout"),
                        )
                    }
                    host.onSessionReplacedLogout()
                    releaseBridge()
                    return@launch
                }
                if (!authRecoveryAttempted) {
                    authRecoveryAttempted = true
                    if (host.tryAuthRefreshAndReconnect()) {
                        return@launch
                    }
                }
                if (reason == null) {
                    runCatching {
                        MobileTelemetry.trackBusinessEvent(
                            "realtime_auth_recovery",
                            mapOf("result" to "heuristic_transient_no_logout"),
                        )
                    }
                    host.onHeuristicTransientAuthError(error)
                    releaseBridge()
                    return@launch
                }
                runCatching {
                    MobileTelemetry.trackBusinessEvent(
                        "realtime_auth_recovery",
                        mapOf("result" to "terminal_logout"),
                    )
                }
                host.onTerminalAuthFailure()
                releaseBridge()
            }.also { job ->
                job.invokeOnCompletion {
                    if (authRecoveryJob === job) {
                        authRecoveryJob = null
                    }
                }
            }
    }

    private fun isAuthRelatedRealtimeError(error: Throwable): Boolean {
        realtimeAuthReason(error)?.let { return true }
        val combined = realtimeErrorSummary(error).lowercase()
        return combined.contains("unauthorized") ||
            combined.contains("401") ||
            combined.contains("forbidden") ||
            combined.contains("403") ||
            (combined.contains("token") && (combined.contains("invalid") || combined.contains("expired")))
    }

    private fun realtimeAuthReason(error: Throwable): String? {
        val parsed = AuthErrorParser.parseReasonFromText(realtimeErrorSummary(error)) ?: return null
        return if (parsed in KNOWN_REALTIME_AUTH_REASONS) parsed else null
    }

    private fun realtimeErrorSummary(error: Throwable): String =
        buildString {
            append(error.message.orEmpty())
            val cause = error.cause
            if (cause != null && !cause.message.isNullOrBlank()) {
                append(' ')
                append(cause.message)
            }
        }
}
