// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop Content Manager embedded SPA from MobileAndroid.
// Related:
// - ContentManagerWebViewLauncher.kt, MobileContentManagerPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias ContentManagerLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object ContentManagerLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): ContentManagerLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.contentManager,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_content_manager_tunnel_required,
            sessionRequiredRes = R.string.desktop_content_manager_session_required,
        )
}
