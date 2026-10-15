/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-selected light/dark brightness for Empery Mobile, independent of Android system setting.
 *
 * Invariants:
 * - Persisted in the same prefs namespace as [MobileUiStylePreferences].
 * - [SYSTEM] follows [androidx.compose.foundation.isSystemInDarkTheme].
 *
 * Related:
 * - MainActivity.kt, EmperyMobileTheme, ProfileAppearancePreviewCard
 */
package feature.profile

import android.content.Context

enum class MobileColorMode {
    SYSTEM,
    LIGHT,
    DARK,
    ;

    fun resolveDark(systemDark: Boolean): Boolean =
        when (this) {
            SYSTEM -> systemDark
            LIGHT -> false
            DARK -> true
        }

    companion object {
        fun fromStorage(raw: String?): MobileColorMode =
            when (raw?.lowercase()) {
                "light" -> LIGHT
                "dark" -> DARK
                else -> SYSTEM
            }

        fun toStorage(value: MobileColorMode): String =
            when (value) {
                SYSTEM -> "system"
                LIGHT -> "light"
                DARK -> "dark"
            }
    }
}

fun mobileColorModeLabelRes(mode: MobileColorMode): Int =
    when (mode) {
        MobileColorMode.SYSTEM -> R.string.profile_color_mode_system
        MobileColorMode.LIGHT -> R.string.profile_color_mode_light
        MobileColorMode.DARK -> R.string.profile_color_mode_dark
    }
