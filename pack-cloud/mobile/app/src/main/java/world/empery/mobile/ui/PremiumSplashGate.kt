/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gate full-bleed premium splash video so it does not replay on every cold start.
 * Once shown for a given versionCode, subsequent launches skip the Compose splash overlay.
 *
 * Invariants:
 * - Never blocks SecureTokenStore / AppContainer bootstrap.
 * - Hand-embed / non-UI entry points must not call this gate for splash UI.
 * - User can disable intro via Profile → Appearance ([KEY_INTRO_ENABLED]); default on.
 *
 * Related:
 * - PremiumSplashScreen.kt, PremiumSplashSupport.kt, MainActivity setContent, ProfileAppearanceSection
 */
package world.empery.mobile.ui

import android.content.Context

object PremiumSplashGate {
    private const val PREFS_NAME = "empery_mobile_ui"
    private const val KEY_VIDEO_SHOWN_VERSION_CODE = "premium_splash_video_shown_version_code"
    private const val KEY_INTRO_ENABLED = "premium_splash_intro_enabled_v1"

    /**
     * True when the user has not disabled intro video and this install has not yet
     * played the premium splash for [versionCode].
     */
    fun shouldShowOverlay(
        context: Context,
        versionCode: Int,
    ): Boolean {
        if (!isIntroEnabled(context)) return false
        if (versionCode <= 0) return true
        return prefs(context).getInt(KEY_VIDEO_SHOWN_VERSION_CODE, -1) != versionCode
    }

    fun markOverlayShown(
        context: Context,
        versionCode: Int,
    ) {
        if (versionCode <= 0) return
        prefs(context).edit().putInt(KEY_VIDEO_SHOWN_VERSION_CODE, versionCode).apply()
    }

    /** User preference: play framed intro splash (default on). */
    fun isIntroEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_INTRO_ENABLED, true)

    fun setIntroEnabled(
        context: Context,
        enabled: Boolean,
    ) {
        prefs(context).edit().putBoolean(KEY_INTRO_ENABLED, enabled).apply()
    }

    /** Pure helper for unit tests — decide overlay without Android prefs. */
    fun shouldShowForStoredVersion(
        storedVersionCode: Int,
        currentVersionCode: Int,
        introEnabled: Boolean = true,
    ): Boolean {
        if (!introEnabled) return false
        return storedVersionCode != currentVersionCode
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
