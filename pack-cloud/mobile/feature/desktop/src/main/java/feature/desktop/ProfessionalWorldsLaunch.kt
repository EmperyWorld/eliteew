// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop Professional Worlds embedded SPA from MobileAndroid.
// Related:
// - ProfessionalWorldsWebViewLauncher.kt, MobileProfessionalWorldsPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias ProfessionalWorldsLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object ProfessionalWorldsLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): ProfessionalWorldsLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.professionalWorlds,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_professional_worlds_tunnel_required,
            sessionRequiredRes = R.string.desktop_professional_worlds_session_required,
        )
}
