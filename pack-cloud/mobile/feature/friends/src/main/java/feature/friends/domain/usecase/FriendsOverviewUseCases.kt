/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview refresh with Room fallback and explicit cache-only Friends reads.
 *
 * Invariants:
 * - Cancellation is never converted into an offline fallback.
 * - A refresh failure is retained alongside the cached snapshot for honest UI state.
 *
 * Related:
 * - feature.friends.domain.FriendsRepository
 * - feature.friends.presentation.FriendsTabViewModel
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import kotlinx.coroutines.CancellationException

data class FriendsOverviewLoadResult(
    val snapshot: FriendsOverviewSnapshot,
    val refreshFailure: Throwable? = null,
)

class RefreshFriendsOverviewUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun refreshNetwork(): FriendsOverviewSnapshot = repository.refreshOverview()

    suspend operator fun invoke(): FriendsOverviewLoadResult =
        try {
            FriendsOverviewLoadResult(repository.refreshOverview())
        } catch (error: Throwable) {
            if (error is CancellationException) throw error
            FriendsOverviewLoadResult(
                snapshot = repository.loadOverviewFromCache(),
                refreshFailure = error,
            )
        }
}

class LoadFriendsCacheUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun loadOverview(): FriendsOverviewSnapshot = repository.loadOverviewFromCache()

    suspend fun loadFriends(): List<FriendLiteItem> = repository.loadFriendsFromCache()
}
