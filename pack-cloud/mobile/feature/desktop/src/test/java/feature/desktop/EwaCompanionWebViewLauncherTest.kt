package feature.desktop

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EwaCompanionWebViewLauncherTest {
    @Test
    fun companionSpaUrl_usesMobileEwaHash() {
        val url = EwaCompanionWebViewLauncher.companionSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-ewa-companion"))
        assertTrue(url.contains("spaBoot="))
    }

    @Test
    fun isValidWebOrigin_acceptsTrustedHttpsOrigin() {
        assertTrue(EwaCompanionWebViewLauncher.isValidWebOrigin("https://app.eliteew.ru"))
        assertTrue(EwaCompanionWebViewLauncher.isValidWebOrigin("https://app.eliteew.ru/"))
    }

    @Test
    fun isValidWebOrigin_rejectsUntrustedHost() {
        assertFalse(EwaCompanionWebViewLauncher.isValidWebOrigin("https://evil.example.com"))
    }

    @Test
    fun isValidWebOrigin_rejectsHttp() {
        assertFalse(EwaCompanionWebViewLauncher.isValidWebOrigin("http://app.eliteew.ru"))
    }
}
