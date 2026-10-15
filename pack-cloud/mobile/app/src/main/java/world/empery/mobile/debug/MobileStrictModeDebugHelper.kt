/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap performance-005: StrictMode installation for debug builds (log-only penalties).
 *
 * Invariants:
 * - Never enabled in release builds.
 * - Penalties log only; they do not crash the process.
 *
 * Related:
 * - MobileApp.kt, MobileFeatureShellPreferences
 */
package world.empery.mobile.debug

import android.os.StrictMode

object MobileStrictModeDebugHelper {
    /** performance-005 */
    fun installIfDebug(isDebug: Boolean, shellStrictModeEnabled: Boolean = true) {
        if (!isDebug || !shellStrictModeEnabled) return
        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectAll()
                .penaltyLog()
                .build(),
        )
        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectAll()
                .penaltyLog()
                .build(),
        )
    }
}
