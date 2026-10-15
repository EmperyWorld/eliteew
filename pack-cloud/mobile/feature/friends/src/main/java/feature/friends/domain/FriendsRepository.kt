/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends domain repository contract consumed by focused use cases.
 *
 * Invariants:
 * - Domain callers do not depend on Retrofit, Room, Compose, or the app container.
 *
 * Related:
 * - feature.friends.data.DefaultFriendsRepository
 * - feature.friends.domain.usecase.FriendsUseCases
 */
package feature.friends.domain

import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto

interface FriendsRepository {
    suspend fun loadFriendsFromCache(): List<FriendLiteItem>

    suspend fun loadOverviewFromCache(): FriendsOverviewSnapshot

    suspend fun refreshOverview(): FriendsOverviewSnapshot

    suspend fun acceptRequest(requestId: String)

    suspend fun rejectRequest(requestId: String)

    suspend fun cancelRequest(requestId: String)

    suspend fun sendRequest(username: String)

    suspend fun searchUsers(query: String): List<FriendSearchCandidateDto>

    suspend fun sendRequestToUser(userId: String)

    suspend fun getFriendProfile(userId: String): FriendLiteItem

    suspend fun updateRelationship(
        userId: String,
        isFavorite: Boolean? = null,
        isMuted: Boolean? = null,
        isBlocked: Boolean? = null,
        shareActivityWithFriend: Boolean? = null,
        circleIds: List<String>? = null,
        privateNote: String? = null,
    ): FriendLiteItem

    suspend fun reportUser(
        userId: String,
        reason: String,
        details: String?,
    )

    suspend fun loadSocialHubInbox(): List<SocialHubActionInboxItemDto>

    suspend fun loadFriendSharedContent(userId: String): List<SocialHubSharedContentItemDto>

    suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto

    suspend fun loadReferralInvite(): FriendReferralInviteResponseDto

    suspend fun createCircle(name: String): FriendCircleItemDto

    suspend fun deleteCircle(circleId: String)

    suspend fun renameCircle(
        circleId: String,
        name: String,
    ): FriendCircleItemDto

    suspend fun removeFriend(userId: String)
}

fun interface FriendsCacheInvalidator {
    fun invalidateOverviewCache()
}
