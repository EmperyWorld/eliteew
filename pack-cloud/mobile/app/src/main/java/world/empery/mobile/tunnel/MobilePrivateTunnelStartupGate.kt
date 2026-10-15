/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fail-closed gate for private tunnel mode so EliteEW network traffic waits until VPN is up.
 *
 * Invariants:
 * - Public stable mode is never gated.
 * - Private mode may defer/block app/auth network calls until status is CONNECTED
 *   (WAITING_EDGE / CONNECTING / RETRYING still block).
 *
 * Related:
 * - MobileConnectionModeStore, MobilePrivateTunnelManager, MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

import android.content.Context

object MobilePrivateTunnelStartupGate {
    fun shouldBlockEliteEwTraffic(
        context: Context,
        tunnelStatus: MobilePrivateTunnelStatus,
    ): Boolean =
        MobileConnectionModeStore.read(context) == MobileConnectionMode.PRIVATE_TUNNEL_BETA &&
            tunnelStatus != MobilePrivateTunnelStatus.CONNECTED

    fun shouldBlockEliteEwTraffic(
        context: Context,
        tunnelManager: MobilePrivateTunnelManager,
    ): Boolean = shouldBlockEliteEwTraffic(context, tunnelManager.state.value.status)

    fun shouldDeferAuthenticatedNetwork(
        context: Context,
        tunnelStatus: MobilePrivateTunnelStatus,
    ): Boolean = shouldBlockEliteEwTraffic(context, tunnelStatus)

    fun shouldDeferAuthenticatedNetwork(
        context: Context,
        tunnelManager: MobilePrivateTunnelManager,
    ): Boolean = shouldBlockEliteEwTraffic(context, tunnelManager)
}
