package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileA11ySupportTest {
    @Test
    fun compositeFontScale_clampsExtremeSystemScale() {
        assertEquals(1.35f, MobileUiScale.COMFORT.compositeFontScale(2f), 0.001f)
        assertEquals(0.85f, MobileUiScale.COMPACT.compositeFontScale(0.5f), 0.001f)
    }

    @Test
    fun compositeFontScale_passesThroughNormalRange() {
        assertEquals(1.12f, MobileUiScale.COMFORT.compositeFontScale(1f), 0.001f)
        assertEquals(0.94f, MobileUiScale.COMPACT.compositeFontScale(1f), 0.001f)
    }

    @Test
    fun shouldStackMobileChrome_matchesPolicyThreshold() {
        assertFalse(shouldStackMobileChrome(MobileUiScale.COMPACT, systemFontScale = 1f))
        assertTrue(shouldStackMobileChrome(MobileUiScale.STANDARD, systemFontScale = 1.2f))
    }

    @Test
    fun exceedsMobileChromeStackThreshold_usesCanonicalConstant() {
        assertFalse(exceedsMobileChromeStackThreshold(MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD - 0.01f))
        assertTrue(exceedsMobileChromeStackThreshold(MOBILE_STACK_CHROME_FONT_SCALE_THRESHOLD))
    }
}
