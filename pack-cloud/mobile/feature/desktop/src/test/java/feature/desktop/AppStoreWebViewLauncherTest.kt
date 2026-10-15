package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class AppStoreWebViewLauncherTest {
    @Test
    fun appStoreSpaUrl_containsHashRoute() {
        val url =
            AppStoreWebViewLauncher.appStoreSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-app-store"))
    }
}
