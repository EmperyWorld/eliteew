package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class DesktopSettingsWebViewLauncherTest {
    @Test
    fun desktopSettingsSpaUrl_containsHashRoute() {
        val url =
            DesktopSettingsWebViewLauncher.desktopSettingsSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-desktop-settings"))
    }
}
