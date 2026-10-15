// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Launch in-app WebView for embedded desktop SPA routes (`#/mobile-*`) with native SSO bootstrap.
// Invariants:
// - Only HTTPS origins on trusted `*.eliteew.ru` hosts; OIDC tokens passed in-process via Intent extras.
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileEmbeddedSpaSpec.kt
// ---
package feature.desktop

import android.app.Activity
import android.content.Context
import android.content.Intent
import java.net.URI

/** Opens [EmperyMobileEmbeddedSpaWebViewActivity] with native SSO tokens bootstrapped into SPA localStorage. */
object MobileEmbeddedSpaWebViewLauncher {
    const val EXTRA_WEB_ORIGIN: String = "world.empery.mobile.extra.MOBILE_EMBEDDED_WEB_ORIGIN"
    const val EXTRA_ACCESS_TOKEN: String = "world.empery.mobile.extra.MOBILE_EMBEDDED_ACCESS_TOKEN"
    const val EXTRA_REFRESH_TOKEN: String = "world.empery.mobile.extra.MOBILE_EMBEDDED_REFRESH_TOKEN"
    const val EXTRA_SPA_HASH: String = "world.empery.mobile.extra.MOBILE_EMBEDDED_SPA_HASH"
    const val EXTRA_SPA_HASH_QUERY: String = "world.empery.mobile.extra.MOBILE_EMBEDDED_SPA_HASH_QUERY"

    const val MOBILE_WEBVIEW_MARKER_HEADER: String = "X-EliteEW-Mobile-WebView"
    const val MOBILE_REFRESH_HEADER: String = "X-EliteEW-Mobile-Refresh"

    fun spaUrl(
        webOrigin: String,
        spaHash: String,
        hashQuery: String? = null,
    ): String {
        val origin = webOrigin.trim().trimEnd('/')
        val hash = spaHash.trim().trim('/')
        val cacheBust = System.currentTimeMillis()
        val base = "$origin/#/$hash?spaBoot=$cacheBust"
        return appendHashQueryToSpaUrl(base, hashQuery)
    }

    fun webviewBootstrapShellUrl(webOrigin: String): String {
        val origin = webOrigin.trim().trimEnd('/')
        return "$origin/api/v1/auth/mobile-embedded/webview-shell"
    }

    fun isTrustedEmperyHost(host: String?): Boolean =
        host == "eliteew.ru" || host?.endsWith(".eliteew.ru") == true

    fun isValidWebOrigin(raw: String): Boolean {
        val trimmed = raw.trim().trimEnd('/')
        if (trimmed.isEmpty()) return false
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return false
        if (uri.scheme?.lowercase() != "https") return false
        return isTrustedEmperyHost(uri.host)
    }

    fun launch(
        activity: Activity,
        spec: MobileEmbeddedSpaSpec,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
        hashQuery: String? = null,
    ) {
        if (!isValidWebOrigin(webOrigin)) return
        if (accessToken.isBlank() || refreshToken.isBlank()) return
        activity.startActivity(
            buildIntent(activity, spec, webOrigin, accessToken, refreshToken, hashQuery).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
        )
    }

    fun buildIntent(
        context: Context,
        spec: MobileEmbeddedSpaSpec,
        webOrigin: String,
        accessToken: String,
        refreshToken: String,
        hashQuery: String? = null,
    ): Intent =
        Intent(context, EmperyMobileEmbeddedSpaWebViewActivity::class.java).apply {
            putExtra(EXTRA_WEB_ORIGIN, webOrigin.trim().trimEnd('/'))
            putExtra(EXTRA_ACCESS_TOKEN, accessToken)
            putExtra(EXTRA_REFRESH_TOKEN, refreshToken)
            putExtra(EXTRA_SPA_HASH, spec.spaHash)
            hashQuery?.trim()?.takeIf { it.isNotEmpty() }?.let { putExtra(EXTRA_SPA_HASH_QUERY, it) }
        }
}
