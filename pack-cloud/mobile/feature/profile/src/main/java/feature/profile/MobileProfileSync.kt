/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced push and auth-time pull for mobile profile sync; invokes UI refresh after remote apply.
 *
 * Invariants:
 * - Push is coalesced (~900 ms); failures are logged in repository, never crash UI.
 *
 * Related:
 * - MobileProfileRepository.kt, MainActivity.kt, MobileApp.kt
 */
package feature.profile

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MobileProfileSync(
    private val appContext: Context,
    private val repository: MobileProfileRepository,
    private val scope: CoroutineScope,
) {
    var onApplied: ((MobileProfileSnapshot) -> Unit)? = null

    @Volatile
    private var pushJob: Job? = null

    @Volatile
    private var wallpaperJob: Job? = null

    suspend fun pullAndApply(): MobileProfileSnapshot? {
        val snapshot = repository.pullAndApply() ?: return null
        withContext(Dispatchers.Main.immediate) {
            onApplied?.invoke(snapshot)
        }
        return snapshot
    }

    fun schedulePush() {
        pushJob?.cancel()
        pushJob =
            scope.launch(Dispatchers.IO) {
                delay(PUSH_DEBOUNCE_MS)
                repository.pushLocalSnapshot()
            }
    }

    fun scheduleBackgroundWallpaperSync() {
        wallpaperJob?.cancel()
        wallpaperJob =
            scope.launch(Dispatchers.IO) {
                delay(WALLPAPER_DEBOUNCE_MS)
                repository.syncBackgroundWallpaper()
            }
    }

    companion object {
        private const val PUSH_DEBOUNCE_MS = 900L
        private const val WALLPAPER_DEBOUNCE_MS = 600L
    }
}
