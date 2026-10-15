/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide MobileAndroid SSO login launch plan. Login is WebView-only so Keycloak cookies are
 * scoped to the app instead of external browser or Custom Tabs profiles.
 *
 * Invariants:
 * - Production login never returns browser picker or direct AppAuth Custom Tabs plans.
 *
 * Related:
 * - MobileSsoAuthLauncher, EmperySsoWebViewActivity, OidcAuthManager
 */
package world.empery.mobile.core.auth

import android.content.Context

object MobileSsoLaunchPlanner {
    fun shouldOfferBrowserChoice(
        browserCount: Int,
        preferredPackage: String?,
    ): Boolean = browserCount > 1 && preferredPackage.isNullOrBlank()

    fun resolveDirectBrowserPackage(
        browsers: List<MobileSsoBrowserOption>,
        preferredPackage: String?,
        defaultCustomTabsPackage: String?,
    ): String? {
        val preferred =
            preferredPackage?.takeIf { preferred ->
                browsers.any { it.packageName == preferred }
            }
        if (preferred != null) return preferred
        if (browsers.size == 1) return browsers.first().packageName
        return defaultCustomTabsPackage?.takeIf { pkg ->
            browsers.any { it.packageName == pkg }
        } ?: browsers.firstOrNull { it.supportsCustomTabs }?.packageName
    }

    fun planLaunch(
        context: Context,
        @Suppress("UNUSED_PARAMETER")
        oidcAuthManager: OidcAuthManager,
        loginRequest: OidcLoginRequest,
    ): MobileSsoLaunchPlan =
        MobileSsoLaunchPlan.InAppWebView(
            MobileSsoAuthLauncher.createInAppWebViewIntent(context, loginRequest),
        )
}
