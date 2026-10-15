package feature.desktop

import org.junit.Assert.assertEquals
import org.junit.Test

class DesktopHubLogicTest {
    @Test
    fun resolveNextDesktopTheme_cyclesDarkLightAuto() {
        assertEquals("LIGHT", resolveNextDesktopTheme("DARK"))
        assertEquals("AUTO", resolveNextDesktopTheme("LIGHT"))
        assertEquals("DARK", resolveNextDesktopTheme("AUTO"))
        assertEquals("DARK", resolveNextDesktopTheme(null))
        assertEquals("LIGHT", resolveNextDesktopTheme("dark"))
    }

    @Test
    fun normalizeDesktopThemeKey_defaultsUnknownToAuto() {
        assertEquals("AUTO", normalizeDesktopThemeKey(null))
        assertEquals("AUTO", normalizeDesktopThemeKey(""))
        assertEquals("DARK", normalizeDesktopThemeKey("dark"))
    }

    @Test
    fun lazyColumnIndices_matchHubScreenOrder() {
        assertEquals(DesktopHubLazyColumnIndices.HANDOFF, DesktopHubSectionId.HANDOFF.lazyListIndex)
        assertEquals(DesktopHubLazyColumnIndices.CONFIG, DesktopHubSectionId.CONFIG.lazyListIndex)
        assertEquals(DesktopHubLazyColumnIndices.STORE, DesktopHubSectionId.STORE.lazyListIndex)
        assertEquals(10, DesktopHubSectionId.HANDOFF.lazyListIndex)
        assertEquals(17, DesktopHubSectionId.STORE.lazyListIndex)
    }
}
