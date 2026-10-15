package world.empery.mobile.core.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.resolveMobileScaleChromePolicy

class EmperyPlayerChromeScaleTest {
    @Test
    fun compactBaseFont_keepsDockSubtitleAndSwipeHint() {
        val chrome = resolveMobileScaleChromePolicy(MobileUiScale.COMPACT, systemFontScale = 1f)
        val metrics = resolveEmperyPlayerChromeMetrics(chrome)

        assertFalse(metrics.shouldStackChromeActions)
        assertTrue(metrics.showDockSwipeHint)
        assertTrue(metrics.showDockSubtitle)
        assertEquals(44f, metrics.dockArtworkSize.value, 0.01f)
        assertEquals(60f, metrics.primaryPlayButtonSize.value, 0.01f)
        assertFalse(metrics.useIconOnlyToolChips)
    }

    @Test
    fun comfortHighFont_stacksDockAndUsesIconOnlyTools() {
        val chrome = resolveMobileScaleChromePolicy(MobileUiScale.COMFORT, systemFontScale = 1.15f)
        val metrics = resolveEmperyPlayerChromeMetrics(chrome, hasQueueOrFavorites = true)

        assertTrue(metrics.shouldStackChromeActions)
        assertFalse(metrics.showDockSwipeHint)
        assertFalse(metrics.showDockSubtitle)
        assertEquals(0, metrics.dockSubtitleMaxLines)
        assertTrue(metrics.useIconOnlyToolChips)
        assertTrue(metrics.toolChipFullWidth)
        assertEquals(140f, metrics.expandedArtworkSize.value, 0.01f)
        assertEquals(160f, metrics.expandedHeroHeight.value, 0.01f)
    }

    @Test
    fun standardLargeFont_tightensDockChrome() {
        val chrome = resolveMobileScaleChromePolicy(MobileUiScale.STANDARD, systemFontScale = 1.2f)
        val metrics = resolveEmperyPlayerChromeMetrics(chrome)

        assertTrue(metrics.shouldStackChromeActions)
        assertEquals(40f, metrics.dockArtworkSize.value, 0.01f)
        assertEquals(3f, metrics.progressStripHeight.value, 0.01f)
        assertEquals(1, metrics.dockTitleMaxLines)
    }

    @Test
    fun expandedArtwork_scalesWithQueuePresence() {
        val chrome = resolveMobileScaleChromePolicy(MobileUiScale.COMPACT, systemFontScale = 1f)
        val withQueue = resolveEmperyPlayerChromeMetrics(chrome, hasQueueOrFavorites = true)
        val solo = resolveEmperyPlayerChromeMetrics(chrome, hasQueueOrFavorites = false)

        assertEquals(168f, withQueue.expandedArtworkSize.value, 0.01f)
        assertEquals(196f, solo.expandedArtworkSize.value, 0.01f)
        assertEquals(200f, withQueue.expandedHeroHeight.value, 0.01f)
        assertEquals(260f, solo.expandedHeroHeight.value, 0.01f)
    }
}
