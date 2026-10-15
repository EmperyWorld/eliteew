package world.empery.mobile.perimeter

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessGateCustomTabsLauncherTest {
    @Test
    fun isAllowedUrl_acceptsAccessGateOAuthStart() {
        assertTrue(AccessGateCustomTabsLauncher.isAllowedUrl(AccessGateCustomTabsLauncher.OAUTH_START_URL))
    }

    @Test
    fun isAllowedUrl_rejectsUnknownHost() {
        assertFalse(AccessGateCustomTabsLauncher.isAllowedUrl("https://evil.example/oauth/yandex/start"))
        assertFalse(AccessGateCustomTabsLauncher.isAllowedUrl("http://access.eliteew.ru/"))
    }
}
