/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Android platform connectivity to EliteEW-usable network in private tunnel split-VPN mode.
 *
 * Invariants:
 * - Private mode is CONNECTED-only (fail-closed): Wi‑Fi alone must not look “online”.
 * - Split-tunnel VPN (AllowedIPs 10.88.88.1/32) may be CONNECTED while platform VALIDATED is false.
 * - Public stable mode must follow platform validated reachability only.
 *
 * Related:
 * - ConnectivityObserver, MainActivity OfflineBanner, MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

object MobilePrivateTunnelConnectivity {
    fun isEliteEwNetworkAvailable(
        platformValidated: Boolean,
        privateTunnelRuntimeMode: Boolean,
        tunnelStatus: MobilePrivateTunnelStatus,
    ): Boolean {
        if (privateTunnelRuntimeMode) {
            return tunnelStatus == MobilePrivateTunnelStatus.CONNECTED
        }
        return platformValidated
    }
}
