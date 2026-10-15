package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class EwDeskWebViewLauncherTest {
    @Test
    fun ewDeskSpaUrl_containsHashRoute() {
        val url = EwDeskWebViewLauncher.ewDeskSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-ewdesk"))
    }
}
