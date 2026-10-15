// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with desktop App Store SPA (`#/mobile-app-store`).
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileAppStorePage.tsx
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

object AppStoreWebViewLauncher {
    const val MOBILE_APP_STORE_HASH: String = "mobile-app-store"

    fun appStoreSpaUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(webOrigin, MOBILE_APP_STORE_HASH)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.appStore,
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
            spec = MobileEmbeddedSpaSpecs.appStore,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
        )
}
