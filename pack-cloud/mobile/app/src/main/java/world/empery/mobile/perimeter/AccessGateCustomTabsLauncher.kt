/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Launch Yandex access-gate OAuth in Chrome Custom Tabs with a strict host allowlist.
 *
 * Invariants:
 * - Only https://access.eliteew.ru paths are allowed; no WebView for OAuth.
 *
 * Related:
 * - PerimeterAccessCoordinator, documentation/platform/docker-re_doc/YANDEX-ID-ACCESS-GATE.md
 */
package world.empery.mobile.perimeter

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

object AccessGateCustomTabsLauncher {
    const val OAUTH_START_URL = "https://access.eliteew.ru/oauth/yandex/start"
    const val LANDING_URL = "https://access.eliteew.ru/"

    private val ALLOWED_HOSTS = setOf("access.eliteew.ru")

    fun isAllowedUrl(url: String): Boolean {
        val uri = runCatching { java.net.URI(url.trim()) }.getOrNull() ?: return false
        if (uri.scheme?.lowercase() != "https") return false
        return uri.host?.lowercase() in ALLOWED_HOSTS
    }

    fun launch(context: Context, url: String = OAUTH_START_URL) {
        require(isAllowedUrl(url)) { "Blocked access-gate URL: $url" }
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(context, Uri.parse(url))
    }
}
