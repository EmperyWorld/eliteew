package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileUiScaleComposerTest {
    @Test
    fun composePhoneOnly_usesPhoneScaleFactors() {
        val effective = MobileUiScaleComposer.composePhoneOnly(phoneScale = MobileUiScale.COMPACT)
        assertEquals(0.75f, effective.layoutDensityFactor, 0.001f)
        assertEquals(0.94f, effective.textFontScaleFactor, 0.001f)
    }
}
