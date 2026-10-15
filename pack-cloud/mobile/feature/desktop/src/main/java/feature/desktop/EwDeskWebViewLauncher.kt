// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with desktop EWDesk SPA (`#/mobile-ewdesk`).
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileEwDeskPage.tsx
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

object EwDeskWebViewLauncher {
    const val MOBILE_EWDESK_HASH: String = "mobile-ewdesk"

    fun ewDeskSpaUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(webOrigin, MOBILE_EWDESK_HASH)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.ewDesk,
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
            spec = MobileEmbeddedSpaSpecs.ewDesk,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
}
