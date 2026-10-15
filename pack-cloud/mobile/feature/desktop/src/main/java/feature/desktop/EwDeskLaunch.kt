// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop EWDesk embedded SPA from MobileAndroid.
// Related:
// - EwDeskWebViewLauncher.kt, MobileEwDeskPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias EwDeskLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object EwDeskLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): EwDeskLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.ewDesk,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_ewdesk_tunnel_required,
            sessionRequiredRes = R.string.desktop_ewdesk_session_required,
        )
}
