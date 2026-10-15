/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared spacing, radii, and typography helpers for MobileAndroid Compose surfaces.
 *
 * Invariants:
 * - Token values are dp/sp constants; callers scale layout via MobileUiScale at the shell layer.
- No network or persistence in this module.
 *
 * Related:
 * PremiumGlass.kt, MobileTouchTarget.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class MobileSpacingTokens(
    val xxs: Dp = 4.dp,
    val xs: Dp = 8.dp,
    val sm: Dp = 12.dp,
    val md: Dp = 16.dp,
    val lg: Dp = 20.dp,
    val xl: Dp = 24.dp,
    val xxl: Dp = 32.dp,
)

@Immutable
data class MobileRadiusTokens(
    val sm: Dp = 12.dp,
    val md: Dp = 18.dp,
    val lg: Dp = 22.dp,
    val pill: Dp = 999.dp,
)

object MobileDesignTokens {
    val spacing = MobileSpacingTokens()
    val radii = MobileRadiusTokens()

    val bottomNavTopRadius = 30.dp
    val snackbarRadius = 18.dp
    val sectionElevation = 1.dp

    fun contentMaxWidthFor(widthClass: MobileWindowWidthClass): Int = Int.MAX_VALUE

    fun gridMinCellWidthFor(widthClass: MobileWindowWidthClass): Int =
        when (widthClass) {
            MobileWindowWidthClass.Compact -> 320
            MobileWindowWidthClass.Medium -> 280
            MobileWindowWidthClass.Expanded -> 260
            MobileWindowWidthClass.Large -> 250
            MobileWindowWidthClass.ExtraLarge -> 240
        }

    fun navRailWidthFor(widthClass: MobileWindowWidthClass): Int =
        when (widthClass) {
            MobileWindowWidthClass.Compact -> 0
            MobileWindowWidthClass.Medium -> 72
            MobileWindowWidthClass.Expanded -> 80
            MobileWindowWidthClass.Large -> 104
            MobileWindowWidthClass.ExtraLarge -> 112
        }

    fun chatListPaneWidthFor(widthClass: MobileWindowWidthClass): Int =
        when (widthClass) {
            MobileWindowWidthClass.Compact -> 0
            MobileWindowWidthClass.Medium -> 360
            MobileWindowWidthClass.Expanded -> 400
            MobileWindowWidthClass.Large -> 420
            MobileWindowWidthClass.ExtraLarge -> 420
        }

    fun chatThreadMaxWidthFor(widthClass: MobileWindowWidthClass): Int =
        when (widthClass) {
            MobileWindowWidthClass.Compact -> Int.MAX_VALUE
            MobileWindowWidthClass.Medium -> 640
            MobileWindowWidthClass.Expanded -> 680
            MobileWindowWidthClass.Large -> 720
            MobileWindowWidthClass.ExtraLarge -> 720
        }

    @Composable
    fun sectionTitleStyle(): TextStyle = MaterialTheme.typography.titleMedium

    @Composable
    fun metricValueStyle(): TextStyle = MaterialTheme.typography.titleSmall

    @Composable
    fun metricLabelStyle(): TextStyle = MaterialTheme.typography.labelSmall

    @Composable
    fun bodyMutedStyle(): TextStyle =
        MaterialTheme.typography.bodyMedium.copy(
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
}
