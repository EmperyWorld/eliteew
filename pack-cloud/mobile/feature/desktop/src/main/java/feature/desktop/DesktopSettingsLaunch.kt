// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch desktop Settings Center embedded SPA from MobileAndroid.
// Related:
// - DesktopSettingsWebViewLauncher.kt, MobileDesktopSettingsPage.tsx, MainActivity.kt
// ---
package feature.desktop

import androidx.activity.ComponentActivity

typealias DesktopSettingsLaunchOutcome = MobileEmbeddedSpaLaunchOutcome

object DesktopSettingsLaunch {
    fun tryLaunch(
        activity: ComponentActivity,
        webOrigin: String,
        accessToken: String?,
        refreshToken: String?,
        privateTunnelBootstrapBlocked: Boolean,
    ): DesktopSettingsLaunchOutcome =
        MobileEmbeddedSpaLaunch.tryLaunch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.desktopSettings,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            privateTunnelBootstrapBlocked = privateTunnelBootstrapBlocked,
            tunnelRequiredRes = R.string.desktop_settings_entry_tunnel_required,
            sessionRequiredRes = R.string.desktop_settings_entry_session_required,
        )
}
