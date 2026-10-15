/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for legacy SSO browser helpers and current WebView-only launch-plan policy.
 *
 * Invariants:
 * - Tests pure helpers only; no assemble/APK.
 *
 * Related:
 * - MobileSsoBrowserCatalog, MobileSsoLaunchPlanner
 */
package world.empery.mobile.core.auth

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import net.openid.appauth.AuthorizationService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileSsoBrowserCatalogTest {
    @Test
    fun rankBrowserOptions_prefersChromeThenCustomTabsThenLabel() {
        val ranked =
            MobileSsoBrowserCatalog.rankBrowserOptions(
                listOf(
                    MobileSsoBrowserOption("org.example.browser", "Example", supportsCustomTabs = false),
                    MobileSsoBrowserOption("com.android.chrome", "Chrome", supportsCustomTabs = true),
                    MobileSsoBrowserOption("com.other.cct", "Other", supportsCustomTabs = true),
                ),
            )
        assertEquals("com.android.chrome", ranked[0].packageName)
        assertEquals("com.other.cct", ranked[1].packageName)
        assertEquals("org.example.browser", ranked[2].packageName)
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileSsoLaunchPlannerTest {
    @Test
    fun planLaunch_returnsInAppWebViewForPhoneLogin() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val manager =
            OidcAuthManager(
                appContext = context,
                authorizationService = AuthorizationService(context),
                authorizationEndpoint = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth",
                tokenEndpoint = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token",
                clientId = "empery-mobile",
                redirectUri = "world.empery.mobile:/oauth2redirect",
            )
        val loginRequest =
            OidcLoginRequest(
                intent = Intent(Intent.ACTION_VIEW),
                authorizationUrl = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth?client_id=x",
                redirectUri = "world.empery.mobile:/oauth2redirect",
                state = "state-test",
                codeVerifier = "verifier-test",
            )

        val plan =
            MobileSsoLaunchPlanner.planLaunch(
                context = context,
                oidcAuthManager = manager,
                loginRequest = loginRequest,
            )

        assertTrue(plan is MobileSsoLaunchPlan.InAppWebView)
        plan as MobileSsoLaunchPlan.InAppWebView
        assertEquals(EmperySsoWebViewActivity::class.java.name, plan.intent.component?.className)
    }

    @Test
    fun shouldOfferBrowserChoice_whenMultipleBrowsersAndNoPreference() {
        assertTrue(MobileSsoLaunchPlanner.shouldOfferBrowserChoice(browserCount = 2, preferredPackage = null))
    }

    @Test
    fun shouldNotOfferBrowserChoice_whenPreferenceSaved() {
        assertFalse(
            MobileSsoLaunchPlanner.shouldOfferBrowserChoice(
                browserCount = 3,
                preferredPackage = "com.android.chrome",
            ),
        )
    }

    @Test
    fun shouldNotOfferBrowserChoice_whenSingleBrowser() {
        assertFalse(MobileSsoLaunchPlanner.shouldOfferBrowserChoice(browserCount = 1, preferredPackage = null))
    }

    @Test
    fun resolveDirectBrowserPackage_usesSavedPreferenceWhenInstalled() {
        val browsers =
            listOf(
                MobileSsoBrowserOption("com.android.chrome", "Chrome", supportsCustomTabs = true),
                MobileSsoBrowserOption("org.mozilla.firefox", "Firefox", supportsCustomTabs = false),
            )
        assertEquals(
            "org.mozilla.firefox",
            MobileSsoLaunchPlanner.resolveDirectBrowserPackage(
                browsers = browsers,
                preferredPackage = "org.mozilla.firefox",
                defaultCustomTabsPackage = "com.android.chrome",
            ),
        )
    }

    @Test
    fun resolveDirectBrowserPackage_fallsBackToCustomTabsDefault() {
        val browsers =
            listOf(
                MobileSsoBrowserOption("org.mozilla.firefox", "Firefox", supportsCustomTabs = false),
                MobileSsoBrowserOption("com.android.chrome", "Chrome", supportsCustomTabs = true),
            )
        assertEquals(
            "com.android.chrome",
            MobileSsoLaunchPlanner.resolveDirectBrowserPackage(
                browsers = browsers,
                preferredPackage = null,
                defaultCustomTabsPackage = "com.android.chrome",
            ),
        )
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileSsoBrowserPreferencesTest {
    @Test
    fun setPreferredPackage_roundTripsThroughSharedPreferences() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        MobileSsoBrowserPreferences.clearPreferredPackage(context)
        MobileSsoBrowserPreferences.setPreferredPackage(context, "com.android.chrome")
        assertEquals("com.android.chrome", MobileSsoBrowserPreferences.getPreferredPackage(context))
        MobileSsoBrowserPreferences.clearPreferredPackage(context)
    }
}
