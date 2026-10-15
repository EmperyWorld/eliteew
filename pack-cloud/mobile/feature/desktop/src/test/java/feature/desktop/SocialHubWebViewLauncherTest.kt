package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class SocialHubWebViewLauncherTest {
    @Test
    fun socialHubSpaUrl_containsHashRoute() {
        val url = SocialHubWebViewLauncher.socialHubSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-social-hub"))
    }
}
