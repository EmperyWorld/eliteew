/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Hub tool grid column policy (2×2 → 4 col tiers).
 *
 * Invariants:
 * - —
 *
 * Related:
 * - UgsHubLayoutPolicy.kt, MOBILE-ANDROID-ADAPTIVE-LAYOUT.md
 */
package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.ui.MobileLayoutProfile
import world.empery.mobile.core.ui.MobileWindowLayout
import world.empery.mobile.core.ui.MobileWindowWidthClass

class UgsHubLayoutPolicyTest {
    private fun layout(
        widthDp: Int,
        widthClass: MobileWindowWidthClass,
    ): MobileWindowLayout =
        MobileWindowLayout(
            screenWidthDp = widthDp,
            screenHeightDp = 800,
            smallestScreenWidthDp = widthDp,
            widthClass = widthClass,
            profile = MobileLayoutProfile.Phone,
        )

    @Test
    fun targetColumns_compactIsTwo() {
        assertEquals(2, ugsHubToolsTargetColumnCount(layout(411, MobileWindowWidthClass.Compact)))
    }

    @Test
    fun targetColumns_mediumIsThree() {
        assertEquals(3, ugsHubToolsTargetColumnCount(layout(720, MobileWindowWidthClass.Medium)))
    }

    @Test
    fun targetColumns_expandedIsThree() {
        assertEquals(3, ugsHubToolsTargetColumnCount(layout(900, MobileWindowWidthClass.Expanded)))
    }

    @Test
    fun targetColumns_largeIsFour() {
        assertEquals(4, ugsHubToolsTargetColumnCount(layout(1280, MobileWindowWidthClass.Large)))
    }

    @Test
    fun resolvedColumns_phone411_isTwo() {
        val resolved =
            ugsHubToolsResolvedColumnCount(
                layout(411, MobileWindowWidthClass.Compact),
                availableWidthDp = 411,
            )
        assertEquals(2, resolved)
    }

    @Test
    fun resolvedColumns_questPanel360_isTwo() {
        val resolved =
            ugsHubToolsResolvedColumnCount(
                layout(360, MobileWindowWidthClass.Compact),
                availableWidthDp = 360,
            )
        assertEquals(2, resolved)
    }

    @Test
    fun resolvedColumns_tablet720_isThree() {
        val resolved =
            ugsHubToolsResolvedColumnCount(
                layout(720, MobileWindowWidthClass.Medium),
                availableWidthDp = 720,
            )
        assertEquals(3, resolved)
    }

    @Test
    fun resolvedColumns_dex1280_isFour() {
        val resolved =
            ugsHubToolsResolvedColumnCount(
                layout(1280, MobileWindowWidthClass.Large),
                availableWidthDp = 1280,
            )
        assertEquals(4, resolved)
    }

    @Test
    fun resolvedColumns_veryNarrow_fallsBackToOne() {
        val resolved =
            ugsHubToolsResolvedColumnCount(
                layout(280, MobileWindowWidthClass.Compact),
                availableWidthDp = 280,
            )
        assertEquals(1, resolved)
    }
}
