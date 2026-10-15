/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist perimeter auto-renew opt-in and last renewal attempt timestamp for cooldown.
 *
 * Invariants:
 * - Auto-renew defaults to false until user enables it in Profile.
 *
 * Related:
 * - PerimeterAccessRepository, PerimeterAccessRenewPolicy
 */
package feature.profile

import android.content.Context

object PerimeterAccessPrefs {
    private const val PREFS_NAME = "world.empery.mobile.perimeter_access"
    private const val KEY_AUTO_RENEW = "auto_renew_enabled"
    private const val KEY_LAST_RENEW_ATTEMPT_MS = "last_renew_attempt_epoch_ms"

    fun readAutoRenewEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_AUTO_RENEW, false)

    fun setAutoRenewEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AUTO_RENEW, enabled)
            .apply()
    }

    fun readLastRenewAttemptMs(context: Context): Long =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_RENEW_ATTEMPT_MS, 0L)

    fun markRenewAttempt(context: Context, epochMs: Long = System.currentTimeMillis()) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_RENEW_ATTEMPT_MS, epochMs)
            .apply()
    }
}
