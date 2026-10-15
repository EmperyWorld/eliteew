/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Perimeter renew + private-tunnel realtime cutover/resume hooks owned by MainViewModel
 * (W1 atomization). Keeps Activity/shell call sites on MainViewModel delegates.
 *
 * Invariants:
 * - Hard cutover pauses realtime before NIC/VPN flip; resume waits host delay then reconnects.
 * - Authenticated network deferral follows MobilePrivateTunnelStartupGate.
 *
 * Related:
 * - MainViewModel, PerimeterAccessCoordinator, MobilePrivateTunnelStartupGate, MobileApp handover
 */
package world.empery.mobile.shell

import android.app.Application
import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import world.empery.mobile.MobileApp
import world.empery.mobile.di.AppContainer
import world.empery.mobile.perimeter.PerimeterAccessCoordinator
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate

/** Realtime / auth hooks PerimeterTunnelSessionFacade needs from MainViewModel. */
interface PerimeterTunnelSessionHost {
    fun application(): Application

    fun isAuthenticated(): Boolean

    fun syncPerimeterCoordinatorFlags()

    fun shouldDeferAuthenticatedNetworkForPrivateTunnel(): Boolean

    fun ensureAuthenticatedConnection()

    fun invalidateRealtimeBridgeAndReconnect()

    fun prepareRealtimePauseForCutover()

    fun scheduleBackgroundSyncIfTunnelReady()
}

class PerimeterTunnelSessionFacade(
    private val scope: CoroutineScope,
    private val container: AppContainer,
    private val perimeterCoordinator: PerimeterAccessCoordinator,
    private val host: PerimeterTunnelSessionHost,
) {
    fun syncFlags(
        authenticated: Boolean,
        appInForeground: Boolean,
    ) {
        perimeterCoordinator.isAuthenticated = authenticated
        perimeterCoordinator.appInForeground = appInForeground
    }

    fun onNetworkRestored(clearTransientAuthDeferral: () -> Unit) {
        clearTransientAuthDeferral()
        host.syncPerimeterCoordinatorFlags()
        perimeterCoordinator.onNetworkRestored()
        if (!host.isAuthenticated()) return
        if (host.shouldDeferAuthenticatedNetworkForPrivateTunnel()) {
            Log.i(TAG, "Network restored while private tunnel is disconnected; deferring authenticated sync")
            return
        }
        host.ensureAuthenticatedConnection()
    }

    fun onUnderlyingNetworkChanged() {
        if (!host.isAuthenticated()) return
        if (host.shouldDeferAuthenticatedNetworkForPrivateTunnel()) return
        Log.i(TAG, "Underlying network changed; soft realtime invalidate")
        host.invalidateRealtimeBridgeAndReconnect()
    }

    fun onActivityResumedForPerimeter() {
        host.syncPerimeterCoordinatorFlags()
        perimeterCoordinator.onActivityResumedAfterRenewalLaunch()
    }

    fun bindPerimeterActivityContext(context: Context) {
        perimeterCoordinator.bindActivityContext(context)
    }

    fun clearPerimeterActivityContext() {
        perimeterCoordinator.clearActivityContext()
    }

    fun handlePerimeterRenewIntent() {
        perimeterCoordinator.handleRenewIntent()
    }

    fun requestManualPerimeterAuth() {
        perimeterCoordinator.onManualRenewRequested()
    }

    fun shouldDeferAuthenticatedNetwork(): Boolean =
        MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
            host.application(),
            container.mobilePrivateTunnelManager,
        )

    fun prepareForPrivateTunnelNetworkCutover() {
        Log.i(TAG, "Private tunnel network cutover: pausing realtime")
        host.prepareRealtimePauseForCutover()
    }

    fun resumeRealtimeAfterPrivateTunnelNetworkCutover(
        resumeDelayMs: Long = PRIVATE_TUNNEL_REALTIME_RESUME_DELAY_MS,
    ) {
        scope.launch {
            delay(resumeDelayMs)
            if (!host.isAuthenticated()) return@launch
            Log.i(TAG, "Private tunnel network cutover: resuming realtime")
            host.ensureAuthenticatedConnection()
            if (!host.shouldDeferAuthenticatedNetworkForPrivateTunnel()) {
                host.scheduleBackgroundSyncIfTunnelReady()
            }
        }
    }

    fun wirePrivateTunnelSocketHandover() {
        (host.application() as MobileApp).privateTunnelSocketHandover =
            object : MobileApp.PrivateTunnelSocketHandover {
                override fun onHardCutover() {
                    prepareForPrivateTunnelNetworkCutover()
                }

                override fun onOrchestratedResume() {
                    resumeRealtimeAfterPrivateTunnelNetworkCutover()
                }
            }
    }

    fun clearPrivateTunnelSocketHandover() {
        (host.application() as MobileApp).privateTunnelSocketHandover = null
    }

    companion object {
        private const val TAG = "PerimeterTunnelSession"
        const val PRIVATE_TUNNEL_REALTIME_RESUME_DELAY_MS = 2_500L
    }
}
