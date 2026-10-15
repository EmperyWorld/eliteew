/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical named Friends use cases required by the DDD presentation contract.
 * Thin wrappers over the repository interface — no Android framework imports.
 *
 * Invariants:
 * - Inputs are normalized before crossing the repository boundary.
 * - Each use case depends only on [FriendsRepository].
 *
 * Related:
 * - FriendsUseCases.kt, FriendsMutationUseCases.kt, FriendsOverviewUseCases.kt
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto

/** Load the cached friends list (Room SSOT). */
class GetFriendsListUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(): List<FriendLiteItem> = repository.loadFriendsFromCache()
}

/** Search users that can be invited / friended. */
class SearchFriendsUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(query: String): List<FriendSearchCandidateDto> {
        val normalized = query.trim()
        require(normalized.isNotEmpty()) { "search query must not be blank" }
        return repository.searchUsers(normalized)
    }
}

/** Send a friend request by username or user id. */
class AddFriendUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun byUsername(username: String) {
        val normalized = username.trim()
        require(normalized.isNotEmpty()) { "username must not be blank" }
        repository.sendRequest(normalized)
    }

    suspend fun byUserId(userId: String) {
        repository.sendRequestToUser(userId.trim().also { require(it.isNotEmpty()) { "userId must not be blank" } })
    }
}

/** Remove an existing friendship (mutual delete). */
class RemoveFriendUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(userId: String) {
        repository.removeFriend(userId.trim().also { require(it.isNotEmpty()) { "userId must not be blank" } })
    }
}

/** Update relationship flags / circles / private note. */
class UpdateFriendStatusUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(
        userId: String,
        isFavorite: Boolean? = null,
        isMuted: Boolean? = null,
        isBlocked: Boolean? = null,
        shareActivityWithFriend: Boolean? = null,
        circleIds: List<String>? = null,
        privateNote: String? = null,
    ): FriendLiteItem =
        repository.updateRelationship(
            userId = userId.trim().also { require(it.isNotEmpty()) { "userId must not be blank" } },
            isFavorite = isFavorite,
            isMuted = isMuted,
            isBlocked = isBlocked,
            shareActivityWithFriend = shareActivityWithFriend,
            circleIds = circleIds,
            privateNote = privateNote,
        )
}

/** Load privacy circles (network with Room fallback). */
class GetFriendCirclesUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(): List<FriendCircleItemDto> =
        try {
            repository.refreshOverview().circles
        } catch (error: Throwable) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            val cached = repository.loadOverviewFromCache().circles
            if (cached.isEmpty()) throw error
            cached
        }
}
