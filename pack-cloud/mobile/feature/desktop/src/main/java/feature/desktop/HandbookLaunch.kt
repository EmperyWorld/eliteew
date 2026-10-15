// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop «Справочник» embedded SPA from MobileAndroid.
// Related:
// - HandbookWebViewLauncher.kt, MobileHandbookPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias HandbookLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object HandbookLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): HandbookLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.handbook,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_handbook_tunnel_required,
            sessionRequiredRes = R.string.desktop_handbook_session_required,
        )
}
