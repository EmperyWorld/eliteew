// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Shared entry for launching embedded SPA WebViews from EW hub, Desktop Hub, or deeplinks.
// Related:
// - MobileEmbeddedSpaLaunch.kt, HandbookLaunch.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias EwaCompanionLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object EwaCompanionLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
        hashQuery: String? = null,
    ): EwaCompanionLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.ewaCompanion,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_ewa_tunnel_required,
            sessionRequiredRes = R.string.desktop_ewa_session_required,
            hashQuery = hashQuery,
        )
}
