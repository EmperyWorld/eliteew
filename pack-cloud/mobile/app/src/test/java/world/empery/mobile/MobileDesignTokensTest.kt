package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.ui.MobileDesignTokens
import world.empery.mobile.core.ui.MobileMinimumTouchTargetDp

class MobileDesignTokensTest {
    @Test
    fun spacing_tokens_are_ordered() {
        val s = MobileDesignTokens.spacing
        assertTrue(s.xxs < s.xs)
        assertTrue(s.xs < s.sm)
        assertTrue(s.md < s.xl)
    }

    @Test
    fun touch_target_meetsMinimumGuideline() {
        assertEquals(48, MobileMinimumTouchTargetDp.value.toInt())
    }

    @Test
    fun defaultStartRoute_matchesRegistry() {
        assertEquals(
            world.empery.mobile.shell.MobileRouteRegistry.defaultStartRoute,
            "feed",
        )
    }
}
