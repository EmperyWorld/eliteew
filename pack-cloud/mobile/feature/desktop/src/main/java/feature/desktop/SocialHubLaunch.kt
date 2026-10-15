// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop Social Hub embedded SPA from MobileAndroid.
// Related:
// - SocialHubWebViewLauncher.kt, MobileSocialHubPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias SocialHubLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object SocialHubLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): SocialHubLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.socialHub,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_social_hub_tunnel_required,
            sessionRequiredRes = R.string.desktop_social_hub_session_required,
        )
}
