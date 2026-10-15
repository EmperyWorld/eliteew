/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OkHttp fail-closed guard for EliteEW private tunnel traffic.
 *
 * Invariants:
 * - Private tunnel mode must not silently use public networking while WireGuard is disconnected.
 * - Public stable mode must never be blocked by this interceptor.
 *
 * Related:
 * - MobilePrivateTunnelStartupGate, MobilePrivateTunnelUserCopy, AppContainer, MOBILE-ANDROID-PRIVATE-TUNNEL.md
 */
package world.empery.mobile.tunnel

import android.content.Context
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException

class MobilePrivateTunnelNetworkGuardInterceptor(
    context: Context,
    private val tunnelManager: MobilePrivateTunnelManager,
) : Interceptor {
    private val appContext = context.applicationContext

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (MobilePrivateTunnelPreConnectAllowlist.isAllowed(request.url)) {
            return chain.proceed(request)
        }
        if (MobilePrivateTunnelStartupGate.shouldBlockEliteEwTraffic(appContext, tunnelManager)) {
            throw IOException(buildFailClosedGuardMessage())
        }
        return chain.proceed(request)
    }

    private fun buildFailClosedGuardMessage(): String =
        "${MobilePrivateTunnelUserCopy.FAIL_CLOSED_HTTP_GUARD_MARKER}:" +
            MobilePrivateTunnelUserCopy.failClosedHttpGuardMessage(appContext)

    companion object {
        /** @deprecated use [MobilePrivateTunnelUserCopy.matchesFailClosedHttpGuard] */
        @Deprecated(
            "Use MobilePrivateTunnelUserCopy.failClosedHttpGuardMessage / matchesFailClosedHttpGuard",
            ReplaceWith("MobilePrivateTunnelUserCopy.FAIL_CLOSED_HTTP_GUARD_MARKER"),
        )
        const val PRIVATE_TUNNEL_DISCONNECTED_MESSAGE: String =
            MobilePrivateTunnelUserCopy.FAIL_CLOSED_HTTP_GUARD_MARKER
    }
}
