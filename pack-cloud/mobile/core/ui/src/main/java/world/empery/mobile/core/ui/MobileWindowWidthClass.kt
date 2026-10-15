/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Material-style window width buckets for adaptive MobileAndroid layouts.
 *
 * Invariants:
 * - Thresholds follow sw600 / sw840 / sw1200 / sw1600; compact path must match legacy phone layout.
 *
 * Related:
 * - MobileLayoutProfile.kt, LocalMobileWindowLayout.kt, MobileAdaptiveLayout.kt
 */
package world.empery.mobile.core.ui

enum class MobileWindowWidthClass {
    Compact,
    Medium,
    Expanded,
    Large,
    ExtraLarge,
    ;

    val supportsNavigationRail: Boolean
        get() = this >= Medium

    val prefersMultiColumnContent: Boolean
        get() = this >= Medium

    val isUltraWide: Boolean
        get() = this >= Large

    companion object {
        fun fromScreenWidthDp(screenWidthDp: Int): MobileWindowWidthClass =
            when {
                screenWidthDp >= EXTRA_LARGE_MIN_WIDTH_DP -> ExtraLarge
                screenWidthDp >= LARGE_MIN_WIDTH_DP -> Large
                screenWidthDp >= EXPANDED_MIN_WIDTH_DP -> Expanded
                screenWidthDp >= MEDIUM_MIN_WIDTH_DP -> Medium
                else -> Compact
            }

        private const val MEDIUM_MIN_WIDTH_DP = 600
        private const val EXPANDED_MIN_WIDTH_DP = 840
        private const val LARGE_MIN_WIDTH_DP = 1200
        private const val EXTRA_LARGE_MIN_WIDTH_DP = 1600
    }
}
