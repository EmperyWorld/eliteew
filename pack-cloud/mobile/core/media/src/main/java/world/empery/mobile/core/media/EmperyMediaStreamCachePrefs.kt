/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User preferences for Empery audio stream cache (Wi‑Fi-only prefetch).
 *
 * Invariants:
 * - Stored in app-private SharedPreferences; default allows cellular prefetch.
 *
 * Related:
 * - EmperyMediaStreamCache, ProfileTabViewModel
 */
package world.empery.mobile.core.media

import android.content.Context

object EmperyMediaStreamCachePrefs {
    private const val PREFS = "empery_media_stream_cache_prefs"
    private const val KEY_WIFI_ONLY_PREFETCH = "wifi_only_prefetch"

    fun isWifiOnlyPrefetch(context: Context): Boolean =
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_WIFI_ONLY_PREFETCH, false)

    fun setWifiOnlyPrefetch(
        context: Context,
        enabled: Boolean,
    ) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WIFI_ONLY_PREFETCH, enabled)
            .apply()
    }
}
