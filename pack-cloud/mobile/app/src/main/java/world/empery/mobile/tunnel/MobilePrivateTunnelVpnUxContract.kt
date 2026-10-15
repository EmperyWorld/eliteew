/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UX contract for EliteEW Secure Connection VpnService card across MobileUiScale presets.
 *
 * Invariants:
 * - Security card actions use ScaledButton/ScaledOutlinedButton (see ProfilePrivateTunnelCard).
 * - Fail-closed banner is shown whenever private mode blocks EliteEW traffic.
 * - Android VPN icon/consent cannot be hidden; copy must say so explicitly.
 *
 * Related:
 * - MobilePrivateTunnelUserCopy, MOBILE-ANDROID-PRIVATE-TUNNEL.md, MOBILE-ANDROID-SCALE-CHROME-POLICY.md
 */
package world.empery.mobile.tunnel

object MobilePrivateTunnelVpnUxContract {
    /** Profile → Security card uses scale-aware buttons at every [world.empery.mobile.core.ui.MobileUiScale]. */
    const val USES_SCALED_ACTION_BUTTONS: Boolean = true

    /** Fail-closed gate blocks HTTP, Socket.IO bootstrap, FCM, and WorkManager until CONNECTED. */
    const val FAIL_CLOSED_UNTIL_CONNECTED: Boolean = true

    /** Only one Android VPN per user profile; conflict surfaces VPN_CONFLICT status. */
    const val SINGLE_VPN_PLATFORM_LIMIT: Boolean = true
}
