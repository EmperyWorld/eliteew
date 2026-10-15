/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map phone [MobileUiScale] preference to effective LocalDensity factors at the shell layer.
 *
 * Invariants:
 * - Layout width adaptation uses [LocalMobileWindowLayout], not density zoom on large screens.
 *
 * Related:
 * - MainActivity.kt, LocalMobileUiScale.kt, MobileAdaptiveLayout.kt
 */
package world.empery.mobile.core.ui

data class EffectiveMobileUiScale(
    val layoutDensityFactor: Float,
    val textFontScaleFactor: Float,
)

object MobileUiScaleComposer {
    fun composePhoneOnly(phoneScale: MobileUiScale): EffectiveMobileUiScale =
        EffectiveMobileUiScale(
            layoutDensityFactor = phoneScale.layoutDensityFactor,
            textFontScaleFactor = phoneScale.textFontScaleFactor,
        )
}
