package world.empery.mobile.shell

import android.content.Context

/**
 * Persists lightweight main-shell UI state across process death.
 */
object MobileShellPreferences {
    private const val PREFS_NAME = "empery_mobile_shell"
    private const val KEY_LAST_BOTTOM_TAB = "last_bottom_tab_route"

    fun getLastBottomTabRoute(context: Context): String? =
        prefs(context).getString(KEY_LAST_BOTTOM_TAB, null)?.let { MobileRouteRegistry.coerceBottomTabRoute(it) }

    fun setLastBottomTabRoute(context: Context, route: String) {
        val tab = MobileRouteRegistry.coerceBottomTabRoute(route) ?: return
        prefs(context).edit().putString(KEY_LAST_BOTTOM_TAB, tab).apply()
    }

    fun clearLastBottomTabRoute(context: Context) {
        prefs(context).edit().remove(KEY_LAST_BOTTOM_TAB).apply()
    }

    fun resolveStartDestination(context: Context): String =
        getLastBottomTabRoute(context) ?: MobileRouteRegistry.defaultStartRoute

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
