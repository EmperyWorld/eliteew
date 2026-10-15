// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with desktop Settings Center SPA (`#/mobile-desktop-settings`).
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileDesktopSettingsPage.tsx
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

object DesktopSettingsWebViewLauncher {
    const val MOBILE_DESKTOP_SETTINGS_HASH: String = "mobile-desktop-settings"

    fun desktopSettingsSpaUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(webOrigin, MOBILE_DESKTOP_SETTINGS_HASH)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.desktopSettings,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
    }

    fun buildIntent(
        context: Context,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ): Intent =
        MobileEmbeddedSpaWebViewLauncher.buildIntent(
            context = context,
            spec = MobileEmbeddedSpaSpecs.desktopSettings,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
}
