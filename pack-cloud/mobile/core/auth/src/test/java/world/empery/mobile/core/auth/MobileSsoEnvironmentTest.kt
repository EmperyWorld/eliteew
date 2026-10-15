package world.empery.mobile.core.auth

import android.net.Uri
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
class MobileSsoEnvironmentTest {
    @Test
    fun trustedAuthorizationUrl_acceptsAuthHost() {
        assertTrue(
            EmperySsoWebViewActivity.isTrustedAuthorizationUrl(
                "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth?client_id=x",
            ),
        )
    }

    @Test
    fun trustedAuthorizationUrl_rejectsExternalHost() {
        assertFalse(
            EmperySsoWebViewActivity.isTrustedAuthorizationUrl("https://evil.example/login"),
        )
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OidcRedirectParseTest {
    @Test
    fun parseLoginCallbackFromRedirectUri_readsCodeAndState() {
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
        val uri = Uri.parse("world.empery.mobile:/oauth2redirect?code=abc&state=xyz")
        val result = manager.parseLoginCallbackFromRedirectUri(uri)
        assertTrue(result is OidcLoginCallback.Success)
        result as OidcLoginCallback.Success
        assertEquals("abc", result.code)
        assertEquals("xyz", result.state)
    }

    @Test
    fun parseLoginCallbackFromRedirectUri_acceptsDoubleSlashHostForm() {
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
        // Keycloak / some stacks emit host-style custom-scheme redirects.
        val uri = Uri.parse("world.empery.mobile://oauth2redirect?code=abc&state=xyz")
        val result = manager.parseLoginCallbackFromRedirectUri(uri)
        assertTrue(result is OidcLoginCallback.Success)
        result as OidcLoginCallback.Success
        assertEquals("abc", result.code)
        assertEquals("xyz", result.state)
    }

    @Test
    fun createIntent_clearsNewTaskFlagsForActivityResult() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent =
            EmperySsoWebViewActivity.createIntent(
                context = context,
                authorizationUrl = "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth?client_id=x",
                redirectUri = "world.empery.mobile:/oauth2redirect",
            )
        assertEquals(0, intent.flags and Intent.FLAG_ACTIVITY_NEW_TASK)
        assertEquals(0, intent.flags and Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
}
