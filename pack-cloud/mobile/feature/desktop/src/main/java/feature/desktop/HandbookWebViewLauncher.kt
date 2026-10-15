// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with desktop «Справочник» SPA (`#/mobile-handbook`).
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileHandbookPage.tsx
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

object HandbookWebViewLauncher {
    const val MOBILE_HANDBOOK_HASH: String = "mobile-handbook"

    fun handbookSpaUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(webOrigin, MOBILE_HANDBOOK_HASH)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.handbook,
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
            spec = MobileEmbeddedSpaSpecs.handbook,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
}
