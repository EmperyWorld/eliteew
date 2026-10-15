/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Application-scoped observer for private-tunnel state: hard HTTP cutover on flap, sync flush on CONNECTED.
 *
 * Invariants:
 * - Active only in PRIVATE_TUNNEL_BETA mode.
 * - Hard cutover never targets auth bootstrap OkHttp (via AppContainer session-client list).
 * - Orchestrated resume: immediate CHAT, then delayed LIGHT (sync storm suppression); hard cutover untouched.
 *
 * Related:
 * - MobilePrivateTunnelRecoveryPolicy, MobileApp, BackgroundSyncWorker, MobileSyncStormGuard
 */
package world.empery.mobile.tunnel

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import world.empery.mobile.MobileApp
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.sync.MobileSyncScheduler
import world.empery.mobile.sync.MobileSyncScope
import world.empery.mobile.sync.MobileSyncStormGuard

class MobilePrivateTunnelRecoveryCoordinator(
    private val app: MobileApp,
    private val scope: CoroutineScope,
) {
    fun start() {
        if (MobileConnectionModeStore.read(app) != MobileConnectionMode.PRIVATE_TUNNEL_BETA) {
            return
        }
        scope.launch {
            var previous = app.container.mobilePrivateTunnelManager.state.value.status
            app.container.mobilePrivateTunnelManager.state
                .map { it.status }
                .distinctUntilChanged()
                .collect { next ->
                    if (MobilePrivateTunnelRecoveryPolicy.shouldHardCutoverSessionHttp(previous, next)) {
                        Log.i(TAG, "Private tunnel hard cutover: $previous -> $next")
                        runCatching {
                            app.container.hardCutoverSessionHttpConnectionsForTunnel()
                        }.onFailure { err ->
                            MobileTelemetry.reportError(err, "private_tunnel_http_hard_cutover_failed")
                        }
                        runCatching {
                            app.privateTunnelSocketHandover?.onHardCutover()
                        }.onFailure { err ->
                            MobileTelemetry.reportError(err, "private_tunnel_socket_hard_cutover_failed")
                        }
                        MobileTelemetry.trackBusinessEvent(
                            "private_tunnel_http_hard_cutover",
                            mapOf(
                                "from" to previous.name.lowercase(),
                                "to" to next.name.lowercase(),
                            ),
                        )
                    }
                    if (MobilePrivateTunnelRecoveryPolicy.shouldOrchestratedResume(previous, next)) {
                        Log.i(TAG, "Private tunnel orchestrated resume: $previous -> $next")
                        runCatching {
                            app.scheduleFcmTokenSyncWithBackend()
                            app.scheduleBackgroundSync()
                            // T0 critical: chat only (immediate).
                            MobileSyncScheduler.enqueueImmediate(
                                app,
                                MobileSyncScope.CHAT,
                                force = true,
                            )
                            // T1 heavy: feed/notif/chat list via LIGHT after stagger.
                            scope.launch {
                                delay(MobileSyncStormGuard.POST_RECOVERY_HEAVY_DELAY_MS)
                                MobileSyncScheduler.enqueueImmediate(
                                    app,
                                    MobileSyncScope.LIGHT,
                                    force = true,
                                    staggeredFollowUp = true,
                                )
                            }
                            app.privateTunnelSocketHandover?.onOrchestratedResume()
                        }.onFailure { err ->
                            MobileTelemetry.reportError(err, "private_tunnel_orchestrated_resume_failed")
                        }
                        MobileTelemetry.trackBusinessEvent(
                            "private_tunnel_orchestrated_resume",
                            mapOf(
                                "from" to previous.name.lowercase(),
                                "to" to next.name.lowercase(),
                            ),
                        )
                    }
                    previous = next
                }
        }
    }

    companion object {
        private const val TAG = "PrivateTunnelRecovery"
    }
}
