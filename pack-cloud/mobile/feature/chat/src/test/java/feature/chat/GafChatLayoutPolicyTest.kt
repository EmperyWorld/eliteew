/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for GAF chat master-detail pane weights and scale-aware row/bubble layout policy.
 *
 * Invariants:
 * - Medium+ list pane weight stays within documented proportional band.
 *
 * Related:
 * - GafChatLayoutPolicy.kt, MOBILE-ANDROID-ADAPTIVE-LAYOUT.md
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.ui.MobileWindowWidthClass

class GafChatLayoutPolicyTest {

    @Test
    fun masterDetailPaneWeights_mediumTabletUsesProportionalListPane() {
        val weights =
            resolveGafChatMasterDetailPaneWeights(
                widthClass = MobileWindowWidthClass.Medium,
                listPaneWidthDp = 360,
                totalWidthDp = 720,
            )
        assertTrue(weights.listWeight in 0.28f..0.42f)
        assertEquals(1f, weights.threadWeight)
    }

    @Test
    fun masterDetailPaneWeights_largeUsesNarrowerListFraction() {
        val medium =
            resolveGafChatMasterDetailPaneWeights(
                widthClass = MobileWindowWidthClass.Medium,
                listPaneWidthDp = 360,
                totalWidthDp = 720,
            )
        val large =
            resolveGafChatMasterDetailPaneWeights(
                widthClass = MobileWindowWidthClass.Large,
                listPaneWidthDp = 420,
                totalWidthDp = 1280,
            )
        assertTrue(large.listWeight <= medium.listWeight)
    }

    @Test
    fun listRowLayout_stacksQuickActionsWhenChromeStacks() {
        val layout =
            resolveGafChatListRowLayout(
                shouldStackChromeActions = true,
                masterDetailListPane = false,
            )
        assertFalse(layout.showQuickActions)
        assertEquals(40, layout.avatarSizeDp)
    }

    @Test
    fun listRowLayout_compactMasterDetailListPane() {
        val layout =
            resolveGafChatListRowLayout(
                shouldStackChromeActions = false,
                masterDetailListPane = true,
            )
        assertFalse(layout.showQuickActions)
        assertTrue(layout.showPartnerSubtitle)
    }

    @Test
    fun bubbleMaxWidth_scalesDownOnStackedChrome() {
        val normal = resolveGafChatBubbleMaxWidthDp(threadMaxWidthDp = 640, shouldStackChromeActions = false)
        val stacked = resolveGafChatBubbleMaxWidthDp(threadMaxWidthDp = 640, shouldStackChromeActions = true)
        assertTrue(stacked.value <= normal.value)
    }
}
