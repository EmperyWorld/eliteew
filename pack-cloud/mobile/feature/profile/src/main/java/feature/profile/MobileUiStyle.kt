/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual palette presets for Empery Mobile (system, glass, premium, emerald, midnight, obsidian).
 *
 * Invariants:
 * - Unknown stored values fall back to [SYSTEM].
 * - [toSurfaceStyle] maps palettes to shared glass/premium surface primitives.
 *
 * Related:
 * - MobileAppTheme.kt, MobileUiStylePreferences
 */
package feature.profile

import android.content.Context
import world.empery.mobile.core.ui.MobileSurfaceStyle

/**
 * Визуальные темы приложения (в духе desktop `desktopVisualSystem`: glass / premium).
 * [SYSTEM] — динамические цвета Material / Android 12+.
 * [OBSIDIAN] — Stealth Premium (#000 / silver); optional user palette (not forced by tunnel).
 */
enum class MobileUiStyle {
    SYSTEM,
    GLASS,
    PREMIUM,
    EMERALD,
    MIDNIGHT,
    OBSIDIAN,
    ;

    fun usesAmbientGradient(): Boolean = this != SYSTEM

    fun toSurfaceStyle(): MobileSurfaceStyle =
        when (this) {
            SYSTEM -> MobileSurfaceStyle.SYSTEM
            GLASS, EMERALD -> MobileSurfaceStyle.GLASS
            PREMIUM, MIDNIGHT, OBSIDIAN -> MobileSurfaceStyle.PREMIUM
        }

    companion object {
        fun fromStorage(raw: String?): MobileUiStyle =
            when (raw?.lowercase()) {
                "glass" -> GLASS
                "premium" -> PREMIUM
                "emerald" -> EMERALD
                "midnight" -> MIDNIGHT
                "obsidian" -> OBSIDIAN
                else -> SYSTEM
            }

        fun toStorage(value: MobileUiStyle): String =
            when (value) {
                SYSTEM -> "system"
                GLASS -> "glass"
                PREMIUM -> "premium"
                EMERALD -> "emerald"
                MIDNIGHT -> "midnight"
                OBSIDIAN -> "obsidian"
            }
    }
}

fun mobileUiStyleLabelRes(style: MobileUiStyle): Int =
    when (style) {
        MobileUiStyle.SYSTEM -> R.string.profile_theme_system
        MobileUiStyle.GLASS -> R.string.profile_theme_glass
        MobileUiStyle.PREMIUM -> R.string.profile_theme_premium
        MobileUiStyle.EMERALD -> R.string.profile_theme_emerald
        MobileUiStyle.MIDNIGHT -> R.string.profile_theme_midnight
        MobileUiStyle.OBSIDIAN -> R.string.profile_theme_obsidian
    }

object MobileUiStylePreferences {
    private const val PREFS = "empery_mobile_ui"
    private const val KEY_STYLE = "mobile_ui_style"
    private const val KEY_COLOR_MODE = "mobile_color_mode"
    private const val KEY_BG_IMAGE = "mobile_ui_bg_image"

    fun get(context: Context): MobileUiStyle {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return MobileUiStyle.fromStorage(p.getString(KEY_STYLE, null))
    }

    fun set(context: Context, style: MobileUiStyle) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_STYLE, MobileUiStyle.toStorage(style))
            .apply()
    }

    fun getColorMode(context: Context): MobileColorMode {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return MobileColorMode.fromStorage(p.getString(KEY_COLOR_MODE, null))
    }

    fun setColorMode(context: Context, mode: MobileColorMode) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_COLOR_MODE, MobileColorMode.toStorage(mode))
            .apply()
    }

    fun getBackgroundImage(context: Context): String? {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return p.getString(KEY_BG_IMAGE, null)
    }

    fun setBackgroundImage(context: Context, uri: String?) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BG_IMAGE, uri)
            .apply()
    }

    fun getNotificationsEnabled(context: Context): Boolean {
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return p.getBoolean("notifications_enabled", true)
    }

    fun setNotificationsEnabled(context: Context, enabled: Boolean) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("notifications_enabled", enabled)
            .apply()
    }
}
