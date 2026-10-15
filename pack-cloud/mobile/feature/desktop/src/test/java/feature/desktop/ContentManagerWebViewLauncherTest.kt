package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class ContentManagerWebViewLauncherTest {
    @Test
    fun contentManagerSpaUrl_containsHashRoute() {
        val url = ContentManagerWebViewLauncher.contentManagerSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-content-manager"))
    }
}
