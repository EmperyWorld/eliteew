package feature.desktop

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EwaCompanionLaunchTest {
    @Test
    fun companionSpaUrl_usesMobileHash() {
        val url = EwaCompanionWebViewLauncher.companionSpaUrl("https://app.eliteew.ru")
        assertTrue(url.contains("/#/mobile-ewa-companion"))
    }

    @Test
    fun launchOutcome_enum_values_stable() {
        assertTrue(EwaCompanionLaunchOutcome.entries.contains(EwaCompanionLaunchOutcome.Launched))
        assertFalse(EwaCompanionLaunchOutcome.entries.isEmpty())
    }
}
