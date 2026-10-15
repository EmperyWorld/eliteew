package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileScaleChromeLayoutPolicyBridgeTest {
    @Test
    fun inlineOnlyFlag_invertsStacking() {
        val stacked = resolveMobileScaleChromePolicy(MobileUiScale.COMFORT, systemFontScale = 1.15f)
        val inline = resolveMobileScaleChromePolicy(MobileUiScale.COMPACT, systemFontScale = 1f)
        assertTrue(stacked.shouldStackChromeActions)
        assertFalse(stacked.showInlineRowQuickActions)
        assertFalse(inline.shouldStackChromeActions)
        assertTrue(inline.showInlineRowQuickActions)
    }
}
