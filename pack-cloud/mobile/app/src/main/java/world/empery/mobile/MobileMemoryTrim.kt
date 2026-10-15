/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Trim Coil memory/disk caches on system memory pressure and background teardown hooks.
 *
 * Invariants:
 * - Never throws; safe from Application callbacks and ViewModel.
 *
 * Related:
 * - MobileApp.onTrimMemory, MainViewModel.teardownRealtimeForBackground
 */
package world.empery.mobile

import android.content.Context
import coil.annotation.ExperimentalCoilApi
import coil.imageLoader

@OptIn(ExperimentalCoilApi::class)
object MobileMemoryTrim {
    fun trimImageCaches(context: Context, aggressive: Boolean = false) {
        runCatching {
            val loader = context.applicationContext.imageLoader
            loader.memoryCache?.clear()
            if (aggressive) {
                loader.diskCache?.clear()
            }
        }
    }
}
