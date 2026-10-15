package world.empery.mobile

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceRequest
import world.empery.mobile.core.auth.MobileSsoBrowserOption
import world.empery.mobile.core.auth.MobileSsoLaunchPlan
import world.empery.mobile.core.auth.OidcLoginRequest

class SsoLoginLaunchShellTest {
    @Test
    fun inAppWebViewPlan_launchesIntent() {
        val intent = Intent(Intent.ACTION_VIEW)
        val step = ssoLoginShellStepForPlan(MobileSsoLaunchPlan.InAppWebView(intent))
        assertTrue(step is SsoLoginShellStep.LaunchIntent)
        assertEquals(intent, (step as SsoLoginShellStep.LaunchIntent).intent)
    }

    @Test
    fun legacyDirectAppAuthPlan_launchesIntent() {
        val intent = Intent(Intent.ACTION_VIEW)
        val step = ssoLoginShellStepForPlan(MobileSsoLaunchPlan.DirectAppAuth(intent))
        assertTrue(step is SsoLoginShellStep.LaunchIntent)
        assertEquals(intent, (step as SsoLoginShellStep.LaunchIntent).intent)
    }

    @Test
    fun chooseBrowserPlan_showsPicker() {
        val request =
            MobileSsoBrowserChoiceRequest(
                loginRequest =
                    OidcLoginRequest(
                        intent = Intent(Intent.ACTION_VIEW),
                        authorizationUrl = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth",
                        redirectUri = "world.empery.mobile:/oauth2redirect",
                        state = "state-test",
                        codeVerifier = "verifier-test",
                    ),
                options =
                    listOf(
                        MobileSsoBrowserOption("com.android.chrome", "Chrome", supportsCustomTabs = true),
                        MobileSsoBrowserOption("org.mozilla.firefox", "Firefox", supportsCustomTabs = false),
                    ),
            )
        val step = ssoLoginShellStepForPlan(MobileSsoLaunchPlan.ChooseBrowser(request))
        assertTrue(step is SsoLoginShellStep.ShowBrowserPicker)
        assertEquals(request, (step as SsoLoginShellStep.ShowBrowserPicker).request)
    }
}
