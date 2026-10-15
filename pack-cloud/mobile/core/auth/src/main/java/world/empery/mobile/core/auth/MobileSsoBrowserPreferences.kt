/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist the user's preferred SSO Custom Tabs browser package between sign-in attempts.
 *
 * Invariants:
 * - Stores package name only; no OAuth secrets.
 *
 * Related:
 * - MobileSsoLaunchPlanner, MobileSsoAuthLauncher
 */
package world.empery.mobile.core.auth

import android.content.Context

object MobileSsoBrowserPreferences {
    private const val PREFS_NAME = "mobile_sso_browser_prefs"
    private const val KEY_PREFERRED_PACKAGE = "preferred_browser_package"

    fun getPreferredPackage(context: Context): String? =
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_PREFERRED_PACKAGE, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    fun setPreferredPackage(
        context: Context,
        packageName: String,
    ) {
        val trimmed = packageName.trim()
        require(trimmed.isNotEmpty()) { "packageName must not be blank" }
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PREFERRED_PACKAGE, trimmed)
            .apply()
    }

    fun clearPreferredPackage(context: Context) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_PREFERRED_PACKAGE)
            .apply()
    }
}
