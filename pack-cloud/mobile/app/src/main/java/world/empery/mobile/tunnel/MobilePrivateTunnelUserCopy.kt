/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing copy for EliteEW Secure Connection / WireGuard VpnService states and fail-closed guards.
 *
 * Invariants:
 * - No operator runbook jargon (WireGuard keys, edge peers, Socket.IO, stack names) in user strings.
 * - Programmatic fail-closed markers stay stable for HTTP guard matching across the app process.
 *
 * Related:
 * - MobilePrivateTunnelManager, MobilePrivateTunnelNetworkGuardInterceptor, MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

import android.content.Context
import feature.profile.R

object MobilePrivateTunnelUserCopy {
    /** Stable marker for OkHttp guard and trusted-device sync retry (not shown verbatim in UI). */
    const val FAIL_CLOSED_HTTP_GUARD_MARKER: String = "eliteew_secure_connection_vpn_not_connected"

    fun failClosedHttpGuardMessage(context: Context): String =
        context.getString(R.string.profile_private_tunnel_fail_closed_http)

    fun matchesFailClosedHttpGuard(message: String?): Boolean =
        message?.contains(FAIL_CLOSED_HTTP_GUARD_MARKER, ignoreCase = true) == true ||
            message?.contains(failClosedHttpGuardMessageEn(), ignoreCase = true) == true ||
            message?.contains(failClosedHttpGuardMessageRu(), ignoreCase = true) == true

    fun statusDetail(
        context: Context,
        status: MobilePrivateTunnelStatus,
    ): String? =
        when (status) {
            MobilePrivateTunnelStatus.NOT_CONFIGURED ->
                context.getString(R.string.profile_private_tunnel_message_not_configured)
            MobilePrivateTunnelStatus.DISCONNECTED ->
                context.getString(R.string.profile_private_tunnel_body)
            MobilePrivateTunnelStatus.PERMISSION_REQUIRED ->
                context.getString(R.string.profile_private_tunnel_message_permission_required)
            MobilePrivateTunnelStatus.VPN_CONFLICT ->
                context.getString(R.string.profile_private_tunnel_conflict_body)
            MobilePrivateTunnelStatus.CONNECTING ->
                context.getString(R.string.profile_private_tunnel_message_connecting)
            MobilePrivateTunnelStatus.WAITING_EDGE ->
                context.getString(R.string.profile_private_tunnel_message_waiting_edge)
            MobilePrivateTunnelStatus.RETRYING ->
                context.getString(R.string.profile_private_tunnel_message_retrying)
            MobilePrivateTunnelStatus.CONNECTED -> null
            MobilePrivateTunnelStatus.STOPPING ->
                context.getString(R.string.profile_private_tunnel_status_stopping)
            MobilePrivateTunnelStatus.ERROR ->
                context.getString(R.string.profile_private_tunnel_error_generic)
        }

    fun configSaved(context: Context): String =
        context.getString(R.string.profile_private_tunnel_message_config_saved)

    fun configRemoved(context: Context): String =
        context.getString(R.string.profile_private_tunnel_message_config_removed)

    fun importRequired(context: Context): String =
        context.getString(R.string.profile_private_tunnel_message_not_configured)

    fun permissionRequired(context: Context): String =
        context.getString(R.string.profile_private_tunnel_message_permission_required)

    fun vpnConflict(context: Context): String =
        context.getString(R.string.profile_private_tunnel_conflict_body)

    fun edgeUnreachable(context: Context): String =
        context.getString(R.string.profile_private_tunnel_error_edge_unreachable)

    fun sanitizeError(
        context: Context,
        raw: Throwable?,
    ): String {
        val redacted =
            raw?.message
                ?.replace(Regex("(PrivateKey|PublicKey)\\s*=\\s*\\S+"), "$1 = <redacted>")
                ?.trim()
                ?.takeIf { it.isNotBlank() }
        return if (redacted == null || looksLikeOperatorDetail(redacted)) {
            context.getString(R.string.profile_private_tunnel_error_generic)
        } else {
            redacted
        }
    }

    private fun looksLikeOperatorDetail(text: String): Boolean {
        val lower = text.lowercase()
        return lower.contains("wireguard") ||
            lower.contains("wg ") ||
            lower.contains("endpoint") ||
            lower.contains("peer") ||
            lower.contains("interface]") ||
            lower.contains("go backend") ||
            lower.contains("setstate")
    }

    private fun failClosedHttpGuardMessageRu(): String = "VPN ещё не подключён"

    private fun failClosedHttpGuardMessageEn(): String = "VPN is not connected yet"
}
