package world.empery.mobile.core.ui

import android.content.res.Configuration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileWindowLayoutTest {
    @Test
    fun widthClass_compactBelow600() {
        assertEquals(MobileWindowWidthClass.Compact, MobileWindowWidthClass.fromScreenWidthDp(411))
    }

    @Test
    fun widthClass_mediumAt600() {
        assertEquals(MobileWindowWidthClass.Medium, MobileWindowWidthClass.fromScreenWidthDp(600))
    }

    @Test
    fun widthClass_expandedAt840() {
        assertEquals(MobileWindowWidthClass.Expanded, MobileWindowWidthClass.fromScreenWidthDp(840))
    }

    @Test
    fun widthClass_largeAt1200() {
        assertEquals(MobileWindowWidthClass.Large, MobileWindowWidthClass.fromScreenWidthDp(1200))
    }

    @Test
    fun widthClass_extraLargeAt1600() {
        assertEquals(MobileWindowWidthClass.ExtraLarge, MobileWindowWidthClass.fromScreenWidthDp(1600))
    }

    @Test
    fun navigationRail_enabledForTabletWidth() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 720
                    screenHeightDp = 1280
                    smallestScreenWidthDp = 720
                },
            )
        assertTrue(layout.useNavigationRail)
        assertFalse(layout.useBottomNavigation)
    }

    @Test
    fun navigationRail_disabledForCompactPhone() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 411
                    screenHeightDp = 891
                    smallestScreenWidthDp = 411
                },
            )
        assertFalse(layout.useNavigationRail)
        assertTrue(layout.useBottomNavigation)
    }

    @Test
    fun contentColumnCount_twoOnMedium() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 600
                    screenHeightDp = 960
                    smallestScreenWidthDp = 600
                },
            )
        assertEquals(2, layout.contentColumnCount)
        assertEquals(2, layout.effectiveContentColumnCount)
    }

    @Test
    fun contentColumnCount_threeOnExpanded() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 900
                    screenHeightDp = 1200
                    smallestScreenWidthDp = 900
                },
            )
        assertEquals(3, layout.contentColumnCount)
    }

    @Test
    fun contentColumnCount_fourOnLarge() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 1280
                    screenHeightDp = 800
                    smallestScreenWidthDp = 800
                },
            )
        assertEquals(4, layout.contentColumnCount)
        assertFalse(layout.shouldCenterShellContent)
        assertTrue(layout.useExpandedNavigationRail)
    }

    @Test
    fun flatLandscape_capsColumnsOnExpanded() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 1200
                    screenHeightDp = 400
                    smallestScreenWidthDp = 600
                },
            )
        assertTrue(layout.isVeryFlatLandscape)
        assertEquals(4, layout.contentColumnCount)
        assertEquals(3, layout.effectiveContentColumnCount)
    }

    @Test
    fun foldableInner_usesBottomNavWhenNarrow() {
        val layout =
            MobileWindowLayout(
                screenWidthDp = 500,
                screenHeightDp = 900,
                smallestScreenWidthDp = 600,
                widthClass = MobileWindowWidthClass.Compact,
                profile = MobileLayoutProfile.FoldableInner,
            )
        assertFalse(layout.useNavigationRail)
        assertTrue(layout.useBottomNavigation)
        assertEquals(2, layout.contentColumnCount)
    }
}
