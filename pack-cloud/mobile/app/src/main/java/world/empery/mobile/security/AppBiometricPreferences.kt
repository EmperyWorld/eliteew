/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local preference for Stealth Premium biometric unlock (does not store tokens).
 *
 * Related:
 * - AppBiometricUnlockPolicy, Profile Security toggle
 */
package world.empery.mobile.security

import android.content.Context

object AppBiometricPreferences {
    private const val PREFS_NAME = "empery_app_biometric"
    private const val KEY_ENABLED = "biometric_unlock_enabled"

    fun isEnabled(context: Context): Boolean =
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_ENABLED, enabled)
            .apply()
    }
}
