/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tunnel / connectivity shell bridge extracted from MainActivity: private-tunnel
 * auto-heal gate, EliteEW network readiness, restore effects, and status banners.
 *
 * Invariants:
 * - Fail-closed: authenticated network/refresh stays deferred while bootstrap is blocked.
 * - Traffic-ready / CONNECTED semantics stay in MobilePrivateTunnelStartupGate + Connectivity.
 * - Authenticated private mode auto-heals DISCONNECTED/ERROR (bounded backoff), not one-shot.
 * - VPN permission launchers stay Activity-owned; bridge only invokes start callbacks.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 * - Heavy tab refresh is delayed after CHAT so first shell frames stay on the UI thread budget.
 *
 * Related:
 * - MainActivity MobileRoot, MobilePrivateTunnelStartupGate, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.os.SystemClock
import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import world.empery.mobile.connectivity.ConnectivityObserver
import world.empery.mobile.connectivity.NetworkLinkSnapshot
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.RootTab
import world.empery.mobile.sync.MobileSyncStormGuard
import world.empery.mobile.tabs.FeedTabViewModel
import world.empery.mobile.tabs.FriendsTabViewModel
import world.empery.mobile.tabs.NotificationsTabViewModel
import world.empery.mobile.tabs.ProfileTabViewModel
import world.empery.mobile.tabs.UgsHubTabViewModel
import world.empery.mobile.tabs.refreshAllTabs
import world.empery.mobile.trusteddevice.TrustedDeviceTunnelConfigRepair
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobilePrivateTunnelConnectivity
import world.empery.mobile.tunnel.MobilePrivateTunnelRecoveryPolicy
import world.empery.mobile.tunnel.MobilePrivateTunnelSnapshot
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.upgrade.MobileUpgradeSessionGate
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val TUNNEL_SHELL_TAG = "TunnelShellBridge"

/** Delay before feed/friends/UGS refresh so first authenticated frame stays interactive. */
private const val AUTH_STARTUP_HEAVY_TAB_DELAY_MS = 450L

/**
 * Derived tunnel / connectivity flags for shell chrome and tab gates.
 */
data class TunnelShellBridgeState(
    val privateTunnelSnapshot: MobilePrivateTunnelSnapshot,
    val privateTunnelRuntimeMode: Boolean,
    val privateTunnelBootstrapBlocked: Boolean,
    val eliteEwNetworkAvailable: Boolean,
    val showSecureConnectionReestablishing: Boolean,
    val showOfflineChrome: Boolean,
    val isOnline: Boolean,
)

/**
 * Collects private-tunnel + platform connectivity state, runs authenticated auto-heal /
 * restore LaunchedEffects, and returns flags consumed by MobileRoot chrome and tab hosts.
 *
 * Permission [ActivityResultLauncher] stays in MainActivity; [onRequestPrivateTunnelStart]
 * must launch VPN consent or start the tunnel. Auto-heal retries DISCONNECTED/ERROR until
 * CONNECTED (or permission/conflict gates); it is not a one-shot cold-start.
 */
@Composable
fun rememberTunnelShellBridge(
    navController: NavHostController,
    transientAuthNetworkDeferral: Boolean,
    mainVm: MainViewModel,
    feedVm: FeedTabViewModel,
    notificationsVm: NotificationsTabViewModel,
    profileVm: ProfileTabViewModel,
    friendsVm: FriendsTabViewModel,
    ugsVm: UgsHubTabViewModel,
    onNetworkRestored: () -> Unit,
    onUnderlyingNetworkChanged: () -> Unit,
    onPrepareForPrivateTunnelNetworkCutover: () -> Unit,
    onRequestPrivateTunnelStart: () -> Unit,
    onProbePerimeterAccess: suspend () -> Unit,
): TunnelShellBridgeState {
    val context = LocalContext.current
    val mobileApp = context.applicationContext as MobileApp
    val shell by mainVm.shellUiState.collectAsStateWithLifecycle()
    val isAuthenticated = shell.isAuthenticated
    val privateTunnelSnapshot by mobileApp.container.mobilePrivateTunnelManager.state.collectAsStateWithLifecycle()
    val privateTunnelRuntimeMode =
        remember(context.applicationContext) {
            AppRuntimeConfig.from(context.applicationContext).connectionMode == MobileConnectionMode.PRIVATE_TUNNEL_BETA
        }
    val privateTunnelBootstrapBlocked =
        MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
            context,
            privateTunnelSnapshot.status,
        )
    var privateTunnelBootstrapBlockedSinceMs by remember { mutableStateOf<Long?>(null) }

    val connectivityObserver =
        remember(context.applicationContext) {
            ConnectivityObserver(context.applicationContext)
        }
    val isOnline by connectivityObserver.observe().collectAsStateWithLifecycle(initialValue = true)
    val eliteEwNetworkAvailable =
        MobilePrivateTunnelConnectivity.isEliteEwNetworkAvailable(
            platformValidated = isOnline,
            privateTunnelRuntimeMode = privateTunnelRuntimeMode,
            tunnelStatus = privateTunnelSnapshot.status,
        )
    val showSecureConnectionReestablishing =
        MobilePrivateTunnelRecoveryPolicy.isSecureConnectionReestablishing(
            privateTunnelRuntimeMode = privateTunnelRuntimeMode,
            status = privateTunnelSnapshot.status,
            configImported = privateTunnelSnapshot.configImported,
            shellAutoHealSuppressed = privateTunnelSnapshot.shellAutoHealSuppressed,
        )
    val showOfflineChrome =
        (!eliteEwNetworkAvailable || transientAuthNetworkDeferral) && !showSecureConnectionReestablishing
    var wasOnline by remember { mutableStateOf(eliteEwNetworkAvailable) }
    var lastLinkIdentity by remember { mutableStateOf<String?>(null) }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    LaunchedEffect(connectivityObserver) {
        connectivityObserver.observeLink().collect { snap: NetworkLinkSnapshot ->
            val prev = lastLinkIdentity
            if (prev != null && prev != snap.linkIdentity && snap.validatedOnline) {
                onUnderlyingNetworkChanged()
            }
            lastLinkIdentity = snap.linkIdentity
        }
    }

    LaunchedEffect(privateTunnelBootstrapBlocked) {
        if (!privateTunnelRuntimeMode) return@LaunchedEffect
        if (privateTunnelBootstrapBlocked) {
            if (privateTunnelBootstrapBlockedSinceMs == null) {
                privateTunnelBootstrapBlockedSinceMs = SystemClock.elapsedRealtime()
                MobileTelemetry.trackBusinessEvent(
                    "private_tunnel_bootstrap_blocked",
                    mapOf("status" to privateTunnelSnapshot.status.name.lowercase()),
                )
            }
        } else {
            val blockedSince = privateTunnelBootstrapBlockedSinceMs
            if (blockedSince != null) {
                MobileTelemetry.trackBusinessEvent(
                    "private_tunnel_bootstrap_ready",
                    mapOf(
                        "duration_ms" to
                            (SystemClock.elapsedRealtime() - blockedSince).coerceAtLeast(0L).toString(),
                    ),
                )
                privateTunnelBootstrapBlockedSinceMs = null
            }
        }
    }

    LaunchedEffect(eliteEwNetworkAvailable) {
        if (eliteEwNetworkAvailable && !wasOnline) {
            if (privateTunnelBootstrapBlocked) {
                Log.i(TUNNEL_SHELL_TAG, "Network restore ignored until private tunnel is connected")
            } else {
                onNetworkRestored()
            }
        }
        wasOnline = eliteEwNetworkAvailable
    }

    LaunchedEffect(isOnline, privateTunnelBootstrapBlocked) {
        if (isOnline && !privateTunnelBootstrapBlocked) {
            runCatching {
                onProbePerimeterAccess()
            }.onFailure { err ->
                Log.w(TUNNEL_SHELL_TAG, "Perimeter probe skipped after network failure", err)
            }
        }
    }

    LaunchedEffect(shell.isAuthenticated, privateTunnelBootstrapBlocked, currentRoute) {
        if (shell.isAuthenticated &&
            privateTunnelBootstrapBlocked &&
            currentRoute != RootTab.Profile.route
        ) {
            MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Profile.route)
        }
    }

    LaunchedEffect(
        shell.isAuthenticated,
        privateTunnelRuntimeMode,
        privateTunnelSnapshot.status,
        privateTunnelSnapshot.configImported,
        privateTunnelSnapshot.shellAutoHealSuppressed,
    ) {
        if (!shell.isAuthenticated || !privateTunnelRuntimeMode) return@LaunchedEffect
        var healAttempt = 0
        while (isActive) {
            val live = mobileApp.container.mobilePrivateTunnelManager.state.value
            if (
                !MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                    privateTunnelRuntimeMode = true,
                    configImported = live.configImported,
                    status = live.status,
                    shellAutoHealSuppressed = live.shellAutoHealSuppressed,
                )
            ) {
                return@LaunchedEffect
            }
            val backoffMs = MobilePrivateTunnelRecoveryPolicy.autoHealBackoffMs(healAttempt)
            if (backoffMs > 0L) {
                delay(backoffMs)
            }
            if (!isActive) return@LaunchedEffect
            val afterBackoff = mobileApp.container.mobilePrivateTunnelManager.state.value
            if (
                !MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                    privateTunnelRuntimeMode = true,
                    configImported = afterBackoff.configImported,
                    status = afterBackoff.status,
                    shellAutoHealSuppressed = afterBackoff.shellAutoHealSuppressed,
                )
            ) {
                return@LaunchedEffect
            }
            Log.i(
                TUNNEL_SHELL_TAG,
                "Private tunnel auto-heal: attempt=$healAttempt status=${afterBackoff.status}",
            )
            MobileTelemetry.trackBusinessEvent(
                "private_tunnel_auto_heal",
                mapOf(
                    "attempt" to healAttempt.toString(),
                    "status" to afterBackoff.status.name.lowercase(),
                ),
            )
            runCatching {
                mobileApp.container.mobilePrivateTunnelManager.reconcilePublishedStatusWithBackend()
            }.onFailure { err ->
                Log.w(TUNNEL_SHELL_TAG, "Private tunnel reconcile before auto-heal failed", err)
            }
            if (healAttempt == 0) {
                runCatching {
                    TrustedDeviceTunnelConfigRepair.repairServerPublicKeyDriftIfNeeded(mobileApp)
                }.onFailure { err ->
                    Log.w(TUNNEL_SHELL_TAG, "Private tunnel server-key drift repair failed", err)
                }
            }
            val afterReconcile = mobileApp.container.mobilePrivateTunnelManager.state.value
            if (
                !MobilePrivateTunnelRecoveryPolicy.shouldAutoHealPrivateTunnel(
                    privateTunnelRuntimeMode = true,
                    configImported = afterReconcile.configImported,
                    status = afterReconcile.status,
                    shellAutoHealSuppressed = afterReconcile.shellAutoHealSuppressed,
                )
            ) {
                return@LaunchedEffect
            }
            onPrepareForPrivateTunnelNetworkCutover()
            onRequestPrivateTunnelStart()
            healAttempt += 1
            delay(MobilePrivateTunnelRecoveryPolicy.AUTO_HEAL_OBSERVE_MS)
        }
    }

    LaunchedEffect(shell.isAuthenticated, privateTunnelBootstrapBlocked) {
        if (!shell.isAuthenticated) return@LaunchedEffect
        MobileUpgradeSessionGate.awaitIfScheduled()
        if (!shell.isAuthenticated) return@LaunchedEffect
        if (privateTunnelBootstrapBlocked) {
            Log.i(TUNNEL_SHELL_TAG, "Authenticated tab refresh deferred until private tunnel is connected")
            return@LaunchedEffect
        }
        val refreshStartedAtMs = SystemClock.elapsedRealtime()
        runCatching {
            // Critical chat path immediately; heavy tabs stagger so first shell frame stays responsive.
            mainVm.refreshChats()
            val heavyDelayMs =
                if (privateTunnelRuntimeMode) {
                    MobileSyncStormGuard.POST_RECOVERY_HEAVY_DELAY_MS
                } else {
                    AUTH_STARTUP_HEAVY_TAB_DELAY_MS
                }
            delay(heavyDelayMs)
            refreshAllTabs(
                feedVm,
                notificationsVm,
                profileVm,
                friendsVm,
                ugsVm,
                staggeredFollowUp = privateTunnelRuntimeMode,
            )
            profileVm.onAuthenticatedNetworkReady()
        }.onSuccess {
            if (privateTunnelRuntimeMode) {
                MobileTelemetry.trackBusinessEvent(
                    "private_tunnel_startup_refresh",
                    mapOf(
                        "result" to "success",
                        "duration_ms" to
                            (SystemClock.elapsedRealtime() - refreshStartedAtMs).coerceAtLeast(0L).toString(),
                        "used_memory_mb" to currentTunnelShellUsedMemoryMb().toString(),
                    ),
                )
            }
        }.onFailure { err ->
            if (privateTunnelRuntimeMode) {
                MobileTelemetry.trackBusinessEvent(
                    "private_tunnel_startup_refresh",
                    mapOf(
                        "result" to "failed",
                        "duration_ms" to
                            (SystemClock.elapsedRealtime() - refreshStartedAtMs).coerceAtLeast(0L).toString(),
                        "used_memory_mb" to currentTunnelShellUsedMemoryMb().toString(),
                    ),
                )
            }
            Log.w(TUNNEL_SHELL_TAG, "Authenticated tab refresh skipped after startup failure", err)
        }
    }

    return TunnelShellBridgeState(
        privateTunnelSnapshot = privateTunnelSnapshot,
        privateTunnelRuntimeMode = privateTunnelRuntimeMode,
        privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
        eliteEwNetworkAvailable = eliteEwNetworkAvailable,
        showSecureConnectionReestablishing = showSecureConnectionReestablishing,
        showOfflineChrome = showOfflineChrome,
        isOnline = isOnline,
    )
}

/**
 * Thin host for secure-connection / offline / realtime socket banners.
 * Socket banners remain gated by tunnel traffic-ready + bootstrap (same as pre-split).
 */
@Composable
fun TunnelShellConnectivityBanners(
    state: TunnelShellBridgeState,
    isAuthenticated: Boolean,
    socketLifecycle: SocketLifecycleState,
    pendingMutations: Int,
) {
    if (state.showSecureConnectionReestablishing) {
        TunnelShellRealtimeStatusBanner(
            message = stringResource(R.string.secure_connection_reestablishing_banner),
        )
    }
    if (state.showOfflineChrome) {
        TunnelShellOfflineBanner(pendingMutations = pendingMutations)
    }
    if (isAuthenticated && state.eliteEwNetworkAvailable && !state.privateTunnelBootstrapBlocked) {
        when (socketLifecycle) {
            SocketLifecycleState.Reconnecting,
            SocketLifecycleState.Connecting,
            ->
                TunnelShellRealtimeStatusBanner(
                    message = stringResource(R.string.realtime_reconnecting_banner),
                )
            SocketLifecycleState.Disconnected,
            SocketLifecycleState.Error,
            ->
                TunnelShellRealtimeStatusBanner(
                    message = stringResource(R.string.realtime_disconnected_banner),
                )
            SocketLifecycleState.Connected -> Unit
        }
    }
}

@Composable
private fun TunnelShellOfflineBanner(pendingMutations: Int = 0) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PremiumRowSurface(
            modifier = Modifier.fillMaxWidth(),
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.72f),
            borderColor = MaterialTheme.colorScheme.error.copy(alpha = 0.28f),
            tonalElevation = 2.dp,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = stringResource(R.string.offline_banner_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    stringResource(R.string.offline_banner_feed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    stringResource(R.string.offline_banner_chat),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    stringResource(R.string.offline_banner_friends),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    stringResource(R.string.offline_banner_sync),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
        if (pendingMutations > 0) {
            PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.pending_mutation_banner, pendingMutations),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun TunnelShellRealtimeStatusBanner(message: String) {
    PremiumRowSurface(
        modifier = Modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.72f),
        borderColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.28f),
        tonalElevation = 1.dp,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    }
}

private fun currentTunnelShellUsedMemoryMb(): Long {
    val runtime = Runtime.getRuntime()
    return ((runtime.totalMemory() - runtime.freeMemory()) / (1024L * 1024L)).coerceAtLeast(0L)
}
