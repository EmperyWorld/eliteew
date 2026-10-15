package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationsWebViewLauncherTest {
    @Test
    fun notificationsSpaUrl_containsHashRoute() {
        val url = NotificationsWebViewLauncher.notificationsSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-notifications"))
    }
}
