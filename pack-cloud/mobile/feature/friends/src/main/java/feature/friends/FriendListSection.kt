/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility facade over Friends overview and cache use cases.
 *
 * Related:
 * - domain/usecase/FriendsOverviewUseCases.kt
 */
package feature.friends

import feature.friends.domain.usecase.LoadFriendsCacheUseCase
import feature.friends.domain.usecase.RefreshFriendsOverviewUseCase

class FriendListSection(
    private val refreshOverview: RefreshFriendsOverviewUseCase,
    private val loadCache: LoadFriendsCacheUseCase,
) {
    suspend fun loadCached(): FriendsOverviewSnapshot = loadCache.loadOverview()

    suspend fun refresh(): FriendsOverviewSnapshot = refreshOverview().snapshot

    suspend fun loadFriendsCached(): List<FriendLiteItem> = loadCache.loadFriends()
}
