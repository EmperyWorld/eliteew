/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * offline-004/007: cache warm on startup and invalidation hooks after mutations.
 *
 * Invariants:
 * - Warm path reads Room only; never blocks UI thread.
 *
 * Related:
 * - MainActivity, BackgroundSyncWorker, TabViewModelRefresh
 */
package world.empery.mobile.sync

import feature.feed.isFeedCacheStale
import kotlinx.coroutines.async
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.shell.MobileFeatureShellPreferences

object MobileOfflineCacheSupport {
    suspend fun warmStartupCaches(container: AppContainer, context: android.content.Context) {
        if (!container.authRepository.hasSession()) return
        coroutineScope {
            async { runCatching { container.profileRepository.loadFromCache() } }
            async { runCatching { container.feedRepository.loadFromCache() } }
            async { runCatching { container.notificationRepository.loadFromCache() } }
            async { runCatching { container.chatRepository.refreshChatList() } }
            async {
                runCatching { container.friendsUseCases.cache.loadOverview() }
                    .onFailure { error ->
                        if (error is CancellationException) throw error
                        MobileTelemetry.reportError(error, "warmStartupCaches.friends failed")
                    }
            }
        }
    }

    suspend fun invalidateAfterFriendMutation(container: AppContainer) {
        runCatching { container.friendsUseCases.overview.refreshNetwork() }
            .onFailure { error ->
                if (error is CancellationException) throw error
                MobileTelemetry.reportError(error, "invalidateAfterFriendMutation failed")
            }
    }

    suspend fun invalidateAfterProfileMutation(container: AppContainer) {
        runCatching { container.profileRepository.refresh() }
    }

    suspend fun invalidateAfterChatSend(container: AppContainer) {
        runCatching { container.chatRepository.refreshChatList() }
    }

    fun isFeedStale(context: android.content.Context): Boolean =
        isFeedCacheStale(MobileFeatureShellPreferences.getFeedLastSuccessEpochMs(context))
}
