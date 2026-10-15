/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Explicit allowlist for authenticated HTTP calls that must work before VPN is up.
 *
 * Invariants:
 * - Only narrowly scoped repair/metadata paths are allowed — not a second product HTTP client.
 * - NetworkGuard consults this list before fail-closed blocking.
 *
 * Related:
 * - MobilePrivateTunnelNetworkGuardInterceptor, TrustedDeviceTunnelConfigRepair
 */
package world.empery.mobile.tunnel

import okhttp3.HttpUrl

object MobilePrivateTunnelPreConnectAllowlist {
    private const val ACTIVE_TUNNEL_METADATA_PATH = "/mobile-devices/active/tunnel-metadata"

    fun isAllowed(url: HttpUrl): Boolean = url.encodedPath.endsWith(ACTIVE_TUNNEL_METADATA_PATH)
}
