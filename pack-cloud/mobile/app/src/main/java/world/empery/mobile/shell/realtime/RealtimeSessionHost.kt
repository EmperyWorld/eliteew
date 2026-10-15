/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtime socket event host + process/foreground connection lifecycle glue for
 * MainViewModel (W1 MainViewModel shrink). Owns heartbeat, background teardown,
 * EmperyConnectionService sync, and RealtimeSocketCoordinator wiring.
 *
 * Invariants:
 * - Connect/defer follows private-tunnel gate + foreground/active-call rules.
 * - Auth recovery paths emit telemetry and never silent-swallow terminal logout.
 *
 * Related:
 * - MainViewModel, RealtimeSocketCoordinator, ChatSessionController, GafVideoCallCoordinator
 */
package world.empery.mobile.shell.realtime

import android.app.Application
import android.util.Log
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import world.empery.mobile.MobileApp
import world.empery.mobile.MobileMemoryPolicy
import world.empery.mobile.MobileMemoryTrim
import world.empery.mobile.R
import world.empery.mobile.chat.ChatSessionController
import world.empery.mobile.connection.EmperyConnectionService
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.perimeter.PerimeterAccessCoordinator
import world.empery.mobile.shell.videocall.GafVideoCallCoordinator

private const val TAG = "RealtimeSessionHost"
private const val FOREGROUND_REALTIME_HEARTBEAT_MS = 30_000L

/** Hooks RealtimeSessionHost needs from MainViewModel (auth state, biometric, logout). */
interface RealtimeSessionBridge {
    fun isAuthenticated(): Boolean

    fun shouldDeferAuthenticatedNetworkForPrivateTunnel(): Boolean

    fun onProcessForegroundBiometric(backgroundStartedAtEpochMs: Long?): Long?

    fun syncPerimeterCoordinatorFlags(appInForeground: Boolean)

    suspend fun performLogoutInternal(clearRemote: Boolean)

    fun appString(resId: Int): String
}

/**
 * Composition helper: RealtimeSocketEventHost impl + connection lifecycle.
 * Public shell API remains on MainViewModel as thin delegates.
 */
class RealtimeSessionHost(
    private val scope: CoroutineScope,
    private val getApplication: () -> Application,
    private val container: AppContainer,
    private val runtimeConfigBaseUrl: () -> String,
    private val perimeterCoordinator: PerimeterAccessCoordinator,
    private val socketLifecycleState: MutableStateFlow<SocketLifecycleState>,
    private val transientAuthNetworkDeferral: MutableStateFlow<Boolean>,
    private val userMessage: MutableSharedFlow<String>,
    private val bridge: RealtimeSessionBridge,
    private val chatSession: () -> ChatSessionController,
    private val gafVideoCall: () -> GafVideoCallCoordinator,
) {
    private var backgroundRealtimeTeardownJob: Job? = null
    private var foregroundRealtimeHeartbeatJob: Job? = null
    private val realtimeTokenRefreshListener: () -> Unit = { invalidateBridgeAndReconnect() }

    var appInForeground: Boolean = false
        private set

    private var backgroundStartedAtEpochMs: Long? = null

    private val eventHost: RealtimeSocketEventHost = EventHostImpl()
    private val coordinator =
        RealtimeSocketCoordinator(scope, socketLifecycleState, eventHost)

    private val appLifecycleObserver =
        object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                appInForeground = true
                backgroundStartedAtEpochMs =
                    bridge.onProcessForegroundBiometric(backgroundStartedAtEpochMs)
                bridge.syncPerimeterCoordinatorFlags(appInForeground)
                cancelBackgroundRealtimeTeardown()
                syncConnectionForegroundService()
                connectIfAllowed()
                reportMobileRealtimeState(foreground = true)
                startForegroundRealtimeHeartbeat()
                chatSession().refreshOpenChatMessagesTail()
            }

            override fun onStop(owner: LifecycleOwner) {
                appInForeground = false
                backgroundStartedAtEpochMs = System.currentTimeMillis()
                stopForegroundRealtimeHeartbeat()
                bridge.syncPerimeterCoordinatorFlags(appInForeground)
                syncConnectionForegroundService()
                reportMobileRealtimeState(foreground = false)
                scheduleBackgroundRealtimeTeardown()
            }
        }

    fun attachProcessLifecycle() {
        val processLifecycle = ProcessLifecycleOwner.get().lifecycle
        appInForeground = processLifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
        processLifecycle.addObserver(appLifecycleObserver)
        (getApplication() as? MobileApp)?.mobileRealtimeStateReporter = { foreground ->
            reportMobileRealtimeState(foreground)
        }
    }

    fun detachProcessLifecycle() {
        ProcessLifecycleOwner.get().lifecycle.removeObserver(appLifecycleObserver)
    }

    fun registerTokenRefreshListener() {
        (getApplication() as MobileApp).setRealtimeTokenRefreshListener(realtimeTokenRefreshListener)
    }

    fun clearTokenRefreshListener() {
        (getApplication() as MobileApp).setRealtimeTokenRefreshListener(null)
    }

    fun clearAuthRecoveryState() = coordinator.clearAuthRecoveryState()

    fun resetAuthRecoveryAttempt() = coordinator.resetAuthRecoveryAttempt()

    fun cancelConnectJob() = coordinator.cancelConnectJob()

    fun releaseBridge() = coordinator.releaseBridge()

    fun connectIfAllowed() = coordinator.connectIfAllowed()

    fun invalidateBridgeAndReconnect() = coordinator.invalidateBridgeAndReconnect()

    fun ensureAuthenticatedConnection() {
        if (!bridge.isAuthenticated()) return
        if (bridge.shouldDeferAuthenticatedNetworkForPrivateTunnel()) {
            Log.i(TAG, "Authenticated connection deferred until private tunnel is connected")
            syncConnectionForegroundService()
            return
        }
        registerTokenRefreshListener()
        syncConnectionForegroundService()
        if (appInForeground || hasActiveRealtimeSession()) {
            connectIfAllowed()
        }
        (getApplication() as MobileApp).scheduleFcmTokenSyncWithBackend()
    }

    fun syncConnectionForegroundService() {
        val app = getApplication()
        if (!bridge.isAuthenticated()) {
            EmperyConnectionService.stop(app)
            return
        }
        if (bridge.shouldDeferAuthenticatedNetworkForPrivateTunnel()) {
            EmperyConnectionService.stop(app)
            return
        }
        if (appInForeground || hasActiveRealtimeSession()) {
            EmperyConnectionService.ensureRunning(app)
        } else {
            EmperyConnectionService.stop(app)
        }
    }

    fun reportMobileRealtimeState(foreground: Boolean) {
        if (!bridge.isAuthenticated()) return
        scope.launch(Dispatchers.IO) {
            runCatching { container.reportMobileRealtimeState(foreground) }
                .onFailure { err ->
                    if (err is CancellationException) throw err
                    Log.d(TAG, "mobile realtime-state report skipped: ${err.javaClass.simpleName}")
                }
        }
    }

    fun teardownForBackground() {
        chatSession().cancelImagePreviewPreload()
        coordinator.releaseBridge()
        chatSession().trimCachesForBackground()
        MobileMemoryTrim.trimImageCaches(getApplication(), aggressive = false)
        reportMobileRealtimeState(foreground = false)
        syncConnectionForegroundService()
    }

    fun prepareRealtimePauseForCutover() {
        coordinator.cancelConnectJob()
        clearAuthRecoveryState()
        teardownForBackground()
    }

    fun cancelBackgroundRealtimeTeardown() {
        backgroundRealtimeTeardownJob?.cancel()
        backgroundRealtimeTeardownJob = null
    }

    fun onCleared() {
        clearTokenRefreshListener()
        cancelConnectJob()
        clearAuthRecoveryState()
        detachProcessLifecycle()
        cancelBackgroundRealtimeTeardown()
        releaseBridge()
    }

    private fun hasActiveRealtimeSession(): Boolean = gafVideoCall().hasActiveCallSession()

    private fun startForegroundRealtimeHeartbeat() {
        stopForegroundRealtimeHeartbeat()
        foregroundRealtimeHeartbeatJob =
            scope.launch {
                while (isActive) {
                    if (!appInForeground) break
                    reportMobileRealtimeState(foreground = true)
                    delay(FOREGROUND_REALTIME_HEARTBEAT_MS)
                }
            }
    }

    private fun stopForegroundRealtimeHeartbeat() {
        foregroundRealtimeHeartbeatJob?.cancel()
        foregroundRealtimeHeartbeatJob = null
    }

    private fun scheduleBackgroundRealtimeTeardown() {
        cancelBackgroundRealtimeTeardown()
        backgroundRealtimeTeardownJob =
            scope.launch {
                delay(MobileMemoryPolicy.BACKGROUND_REALTIME_DISCONNECT_MS)
                if (appInForeground) return@launch
                if (hasActiveRealtimeSession()) return@launch
                teardownForBackground()
            }
    }

    private inner class EventHostImpl : RealtimeSocketEventHost {
        override fun isAuthenticated(): Boolean = bridge.isAuthenticated()

        override fun shouldDeferPrivateTunnel(): Boolean =
            bridge.shouldDeferAuthenticatedNetworkForPrivateTunnel()

        override fun isAppInForeground(): Boolean = appInForeground

        override fun hasActiveRealtimeSession(): Boolean =
            this@RealtimeSessionHost.hasActiveRealtimeSession()

        override suspend fun ensureFreshAccessToken() {
            runCatching { container.authRepository.ensureFreshAccessToken() }
        }

        override fun resolveSocketBaseUrl(): String = runtimeConfigBaseUrl()

        override fun currentAccessToken(): String? = container.authRepository.currentAccessToken()

        override fun onSocketConnected() {
            transientAuthNetworkDeferral.value = false
            resetAuthRecoveryAttempt()
            chatSession().refreshOpenChatMessagesTail()
        }

        override fun onMessageNew(payload: JSONObject) =
            chatSession().handleRealtimeMessageNew(payload)

        override fun onMessageRead(payload: JSONObject) =
            chatSession().handleRealtimeMessageRead(payload)

        override fun onMessageEdited(payload: JSONObject) =
            chatSession().handleRealtimeMessageEdited(payload)

        override fun onMessageDeleted(payload: JSONObject) =
            chatSession().handleRealtimeMessageDeleted(payload)

        override fun onChatCreated() = chatSession().handleRealtimeChatCreated()

        override fun onE2eeConsentChanged(payload: JSONObject) =
            chatSession().handleRealtimeE2eeConsentChanged(payload)

        override fun onNotification(payload: JSONObject) =
            chatSession().handleRealtimeNotification(payload)

        override fun onVideoCallIncoming(payload: JSONObject) =
            gafVideoCall().onVideoCallIncoming(payload)

        override fun onVideoCallAccepted(payload: JSONObject) =
            gafVideoCall().onVideoCallAccepted(payload)

        override fun onVideoCallEnded(payload: JSONObject) =
            gafVideoCall().onVideoCallEnded(payload)

        override fun onNonAuthConnectionError(error: Throwable) {
            perimeterCoordinator.onRealtimeConnectionError(error)
        }

        override suspend fun onSessionReplacedLogout() {
            runCatching {
                MobileTelemetry.trackBusinessEvent(
                    "realtime_auth_recovery",
                    mapOf("result" to "session_replaced_logout"),
                )
            }
            userMessage.emit(bridge.appString(R.string.auth_session_replaced_snackbar))
            bridge.performLogoutInternal(clearRemote = false)
            teardownForBackground()
        }

        override suspend fun tryAuthRefreshAndReconnect(): Boolean {
            val refreshed =
                runCatching { container.authRepository.refreshAccessToken() }
                    .getOrNull()
            if (!refreshed.isNullOrBlank() && bridge.isAuthenticated()) {
                runCatching {
                    MobileTelemetry.trackBusinessEvent(
                        "realtime_auth_recovery",
                        mapOf("result" to "refreshed_reconnect"),
                    )
                }
                invalidateBridgeAndReconnect()
                return true
            }
            return false
        }

        override suspend fun onTerminalAuthFailure() {
            runCatching {
                MobileTelemetry.trackBusinessEvent(
                    "realtime_auth_recovery",
                    mapOf("result" to "terminal_logout"),
                )
            }
            container.authRepository.onTerminalAuthFailure()
            teardownForBackground()
        }

        override fun onHeuristicTransientAuthError(error: Throwable) {
            runCatching {
                MobileTelemetry.trackBusinessEvent(
                    "realtime_auth_recovery",
                    mapOf("result" to "heuristic_transient_no_logout"),
                )
            }
            perimeterCoordinator.onRealtimeConnectionError(error)
            teardownForBackground()
        }
    }
}
