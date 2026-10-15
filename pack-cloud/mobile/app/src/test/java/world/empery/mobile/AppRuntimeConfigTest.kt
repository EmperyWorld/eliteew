package world.empery.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AppRuntimeConfigTest {

    @Test
    fun from_buildsConfigWithHttpsBaseUrl() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val cfg = AppRuntimeConfig.from(ctx)
        assertTrue(cfg.baseUrl.startsWith("https://"))
        assertTrue(cfg.baseUrl.endsWith("/"))
        assertTrue(cfg.ssoLoginUrl.startsWith("https://"))
        assertTrue(cfg.ssoLoginUrl.contains("/auth/sso/login"))
        assertTrue(cfg.keycloakRedirectUri.contains(":"))
        assertTrue(cfg.keycloakAuthorizationEndpoint.contains("/protocol/openid-connect/auth"))
        assertTrue(cfg.keycloakClientId.isNotBlank())
    }
}
