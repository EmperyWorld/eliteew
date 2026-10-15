/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy for when post-OTA SSO refresh may run relative to private-tunnel readiness.
 *
 * Invariants:
 * - Public mode never waits on the tunnel.
 * - Private mode waits until CONNECTED (or a terminal non-healable gate) before refresh.
 *
 * Related:
 * - MobileAppUpgradeCoordinator, MobilePrivateTunnelStatus, MobilePrivateTunnelRecoveryPolicy
 */
package world.empery.mobile.upgrade

import world.empery.mobile.tunnel.MobilePrivateTunnelStatus

object MobileUpgradeSessionReconcilePolicy {
    /** Max wait for Secure Connection before attempting upgrade refresh anyway. */
    const val PRIVATE_TUNNEL_READY_TIMEOUT_MS = 90_000L

    fun shouldWaitForPrivateTunnel(
        privateTunnelRuntimeMode: Boolean,
    ): Boolean = privateTunnelRuntimeMode

    /**
     * Tunnel is ready for upgrade refresh, or waiting is pointless (permission / conflict / user stop).
     */
    fun isPrivateTunnelReadyForSessionReconcile(
        status: MobilePrivateTunnelStatus,
        shellAutoHealSuppressed: Boolean,
    ): Boolean {
        if (status == MobilePrivateTunnelStatus.CONNECTED) return true
        if (shellAutoHealSuppressed) return true
        return when (status) {
            MobilePrivateTunnelStatus.PERMISSION_REQUIRED,
            MobilePrivateTunnelStatus.VPN_CONFLICT,
            MobilePrivateTunnelStatus.NOT_CONFIGURED,
            -> true
            else -> false
        }
    }
}
