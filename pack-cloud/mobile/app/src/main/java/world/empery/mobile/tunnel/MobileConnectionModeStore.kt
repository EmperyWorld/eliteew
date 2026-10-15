/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist the MobileAndroid connection mode for public stable vs private tunnel beta startup behavior.
 *
 * Invariants:
 * - PublicStable is the default and preserves the existing production URL/DNS path.
 * - Mode changes are applied on the next process start; the app does not hot-swap Retrofit graphs.
 *
 * Related:
 * - AppRuntimeConfig, AppContainer, MobilePrivateTunnelManager
 */
package world.empery.mobile.tunnel

import android.content.Context

enum class MobileConnectionMode {
    PUBLIC_STABLE,
    PRIVATE_TUNNEL_BETA,
}

object MobileConnectionModeStore {
    private const val PREFS_NAME = "mobile_connection_mode"
    private const val KEY_MODE = "mode"

    fun read(context: Context): MobileConnectionMode {
        val raw = context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_MODE, null)
            ?.trim()
            ?.uppercase()
        return runCatching { raw?.let(MobileConnectionMode::valueOf) }
            .getOrNull()
            ?: MobileConnectionMode.PUBLIC_STABLE
    }

    fun write(context: Context, mode: MobileConnectionMode) {
        context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MODE, mode.name)
            .commit()
    }
}
