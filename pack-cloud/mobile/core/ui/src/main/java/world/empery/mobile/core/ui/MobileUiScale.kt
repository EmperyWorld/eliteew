/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global UI scale presets (layout density + text) shared across mobile feature modules.
 *
 * Invariants:
 * - STANDARD/COMFORT use icon-only compact controls via [usesIconControls]; COMPACT keeps text labels.
 *
 * Related:
 * - LocalMobileUiScale.kt, ScaledActionButtons.kt, feature.profile.MobileUiScalePreferences
 */
package world.empery.mobile.core.ui

enum class MobileUiScale(
    val layoutDensityFactor: Float,
    val textFontScaleFactor: Float,
) {
    COMPACT(
        layoutDensityFactor = 0.75f,
        textFontScaleFactor = 0.94f,
    ),
    STANDARD(
        layoutDensityFactor = 1.0f,
        textFontScaleFactor = 1.0f,
    ),
    COMFORT(
        layoutDensityFactor = 1.0f,
        textFontScaleFactor = 1.12f,
    ),
    ;

    val usesIconControls: Boolean
        get() = this != COMPACT

    val showsBottomNavLabels: Boolean
        get() = this != COMFORT

    companion object {
        fun fromStorage(raw: String?): MobileUiScale =
            when (raw?.lowercase()) {
                "standard", "1.0", "100" -> STANDARD
                "default" -> COMPACT
                "comfort", "large", "1.125", "112", "1.12" -> COMFORT
                "compact", "0.75", "75" -> COMPACT
                null -> COMPACT
                else -> COMPACT
            }

        fun toStorage(value: MobileUiScale): String =
            when (value) {
                COMPACT -> "compact"
                STANDARD -> "standard"
                COMFORT -> "comfort"
            }
    }
}
