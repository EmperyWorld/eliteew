// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView with the original desktop EWA companion SPA (`#/mobile-ewa-companion`).
// Invariants:
// - Delegates to shared [MobileEmbeddedSpaWebViewLauncher].
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, DesktopHubFeature.kt, MainActivity.kt
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent

/** Opens embedded EWA companion SPA with native SSO tokens bootstrapped into SPA localStorage. */
object EwaCompanionWebViewLauncher {
    const val EXTRA_WEB_ORIGIN: String = MobileEmbeddedSpaWebViewLauncher.EXTRA_WEB_ORIGIN
    const val EXTRA_ACCESS_TOKEN: String = MobileEmbeddedSpaWebViewLauncher.EXTRA_ACCESS_TOKEN
    const val EXTRA_REFRESH_TOKEN: String = MobileEmbeddedSpaWebViewLauncher.EXTRA_REFRESH_TOKEN

    const val MOBILE_EWA_COMPANION_HASH: String = "mobile-ewa-companion"

    fun companionSpaUrl(
        webOrigin: String,
        hashQuery: String? = null,
    ): String =
        MobileEmbeddedSpaWebViewLauncher.spaUrl(
            webOrigin,
            MOBILE_EWA_COMPANION_HASH,
            hashQuery,
        )

    fun webviewBootstrapShellUrl(webOrigin: String): String =
        MobileEmbeddedSpaWebViewLauncher.webviewBootstrapShellUrl(webOrigin)

    const val MOBILE_WEBVIEW_MARKER_HEADER: String =
        MobileEmbeddedSpaWebViewLauncher.MOBILE_WEBVIEW_MARKER_HEADER
    const val MOBILE_REFRESH_HEADER: String = MobileEmbeddedSpaWebViewLauncher.MOBILE_REFRESH_HEADER

    fun isTrustedEmperyHost(host: String?): Boolean =
        MobileEmbeddedSpaWebViewLauncher.isTrustedEmperyHost(host)

    fun isValidWebOrigin(raw: String): Boolean = MobileEmbeddedSpaWebViewLauncher.isValidWebOrigin(raw)

    fun launch(
        activity: Activity,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
        hashQuery: String? = null,
    ) {
        MobileEmbeddedSpaWebViewLauncher.launch(
            activity = activity,
            spec = MobileEmbeddedSpaSpecs.ewaCompanion,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            hashQuery = hashQuery,
        )
    }

    fun buildIntent(
        context: Context,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
        hashQuery: String? = null,
    ): Intent =
        MobileEmbeddedSpaWebViewLauncher.buildIntent(
            context = context,
            spec = MobileEmbeddedSpaSpecs.ewaCompanion,
            webOrigin = webOrigin,
            accessToken = accessToken,
            refreshToken = refreshToken,
            hashQuery = hashQuery,
        )
}
