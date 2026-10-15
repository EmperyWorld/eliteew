package feature.desktop

import org.junit.Assert.assertTrue
import org.junit.Test

class ProfessionalWorldsWebViewLauncherTest {
    @Test
    fun professionalWorldsSpaUrl_containsHashRoute() {
        val url =
            ProfessionalWorldsWebViewLauncher.professionalWorldsSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-professional-worlds"))
    }
}
