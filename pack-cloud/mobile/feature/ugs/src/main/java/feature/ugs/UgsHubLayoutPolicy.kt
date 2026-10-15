/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Width-tier column targets for UGS Hub tool grid (2×2 phone → 4 col DeX), decoupled from feed column caps.
 *
 * Invariants:
 * - Compact tier always targets 2 columns when width allows (see hubToolsMinCellWidthDp).
 * - Medium and Expanded target 3 columns; Large+ target 4.
 *
 * Related:
 * - MOBILE-ANDROID-ADAPTIVE-LAYOUT.md §Feature-ветки (UGS tools)
 * - UgsAiUi.kt, LocalMobileWindowLayout.kt
 */
package feature.ugs

import world.empery.mobile.core.ui.MobileWindowLayout
import world.empery.mobile.core.ui.MobileWindowWidthClass

/** Target column count for hub tool grid per adaptive-layout canon (not feed columnCount). */
internal fun ugsHubToolsTargetColumnCount(layout: MobileWindowLayout): Int =
    when (layout.widthClass) {
        MobileWindowWidthClass.ExtraLarge,
        MobileWindowWidthClass.Large,
        -> 4
        MobileWindowWidthClass.Expanded,
        MobileWindowWidthClass.Medium,
        -> 3
        MobileWindowWidthClass.Compact -> 2
    }

/** Minimum cell width (dp) so two tool tiles fit on typical phones (~360–411dp). */
internal fun ugsHubToolsMinCellWidthDp(layout: MobileWindowLayout): Int =
    when (layout.widthClass) {
        MobileWindowWidthClass.Compact -> 148
        MobileWindowWidthClass.Medium -> 196
        else -> layout.gridMinCellWidthDp
    }

/** Resolved hub grid columns after width-tier target and available row width. */
internal fun ugsHubToolsResolvedColumnCount(
    layout: MobileWindowLayout,
    availableWidthDp: Int,
): Int {
    if (availableWidthDp <= 0) return 1
    val target = ugsHubToolsTargetColumnCount(layout)
    val minCell = ugsHubToolsMinCellWidthDp(layout).coerceAtLeast(1)
    val maxByWidth = availableWidthDp / minCell
    return target.coerceIn(1, maxByWidth.coerceAtLeast(1).coerceAtMost(target))
}
