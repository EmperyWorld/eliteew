/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for legacy browser-choice handoff under WebView-only MobileAndroid login.
 *
 * Invariants:
 * - Canceled choice returns null; selected legacy choice must still launch in-app WebView.
 *
 * Related:
 * - MobileSsoAuthLauncher, MobileSsoBrowserPreferences
 */
package world.empery.mobile.core.auth

import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import net.openid.appauth.AuthorizationService
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileSsoAuthLauncherBrowserChoiceTest {
    @Test
    fun createLaunchIntentAfterBrowserChoice_selectedReturnsWebViewWithoutPreference() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        MobileSsoBrowserPreferences.clearPreferredPackage(context)
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

        val intent =
            MobileSsoAuthLauncher.createLaunchIntentAfterBrowserChoice(
                context = context,
                oidcAuthManager = manager,
                loginRequest = loginRequest,
                result = MobileSsoBrowserChoiceResult.Selected("com.android.chrome"),
            )

        assertNotNull(intent)
        assertEquals(EmperySsoWebViewActivity::class.java.name, intent?.component?.className)
        assertNull(MobileSsoBrowserPreferences.getPreferredPackage(context))
    }

    @Test
    fun createLaunchIntentAfterBrowserChoice_canceled_returnsNullWithoutPreference() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        MobileSsoBrowserPreferences.clearPreferredPackage(context)
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
        assertNull(
            MobileSsoAuthLauncher.createLaunchIntentAfterBrowserChoice(
                context = context,
                oidcAuthManager = manager,
                loginRequest = loginRequest,
                result = MobileSsoBrowserChoiceResult.Canceled,
            ),
        )
        assertNull(MobileSsoBrowserPreferences.getPreferredPackage(context))
    }
}
