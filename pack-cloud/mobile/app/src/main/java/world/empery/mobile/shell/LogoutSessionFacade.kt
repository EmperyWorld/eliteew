/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-domain logout teardown for MainViewModel (push, realtime, chat, media, biometric).
 *
 * Invariants:
 * - Local-only logout skips remote revoke; remote path uses authRepository.logoutWithBackend.
 * - Failures on best-effort cleanup are reported via MobileTelemetry (no silent swallow).
 *
 * Related:
 * - MainViewModel, RealtimeSessionHost, ChatSessionController, BiometricUnlockSessionFacade
 */
package world.empery.mobile.shell

import android.app.Application
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import world.empery.mobile.MainUiState
import world.empery.mobile.MobileApp
import world.empery.mobile.chat.ChatSessionController
import world.empery.mobile.connection.EmperyConnectionService
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.security.BiometricUnlockSessionFacade
import world.empery.mobile.shell.realtime.RealtimeSessionHost
import world.empery.mobile.shell.videocall.GafVideoCallCoordinator

class LogoutSessionFacade(
    private val getApplication: () -> Application,
    private val container: AppContainer,
    private val mainState: MutableStateFlow<MainUiState>,
    private val realtimeSession: () -> RealtimeSessionHost,
    private val chatSession: () -> ChatSessionController,
    private val gafVideoCall: () -> GafVideoCallCoordinator,
    private val biometricSession: BiometricUnlockSessionFacade,
    private val syncPerimeterCoordinatorFlags: () -> Unit,
) {
    suspend fun performLogout(clearRemote: Boolean) {
        if (!mainState.value.isAuthenticated && !container.authRepository.hasSession()) return
        runCatching {
            (getApplication() as MobileApp).unregisterMobilePushTokenFromBackend()
        }.onFailure { err ->
            if (err !is CancellationException) {
                MobileTelemetry.reportError(err, "unregisterMobilePushTokenFromBackend failed")
            }
        }
        val realtime = realtimeSession()
        realtime.cancelConnectJob()
        realtime.clearAuthRecoveryState()
        chatSession().clearForLogout()
        realtime.releaseBridge()
        syncPerimeterCoordinatorFlags()
        EmperyConnectionService.stop(getApplication())
        EmperyMediaPlayerHolder.stopPlaybackIfActive(getApplication())
        realtime.clearTokenRefreshListener()
        if (clearRemote) {
            container.authRepository.logoutWithBackend()
        } else {
            container.authRepository.logoutLocalOnly()
        }
        runCatching { container.clearSessionScopedCache() }
            .onFailure { err ->
                if (err !is CancellationException) {
                    MobileTelemetry.reportError(err, "clearSessionScopedCache failed")
                }
            }
        gafVideoCall().resetOnLogout()
        biometricSession.resetOnLogout()
        mainState.value = MainUiState()
    }
}
