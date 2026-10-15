/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Social Hub/privacy/referral and friend detail/shared-content use cases.
 *
 * Invariants:
 * - Friend detail saves refresh the overview after the relationship mutation.
 *
 * Related:
 * - feature.friends.domain.FriendsRepository
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto

class FriendsSocialHubUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun loadInbox(): List<SocialHubActionInboxItemDto> =
        repository.loadSocialHubInbox()

    suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto =
        repository.loadPrivacyPreview()

    suspend fun loadReferralInvite(): FriendReferralInviteResponseDto =
        repository.loadReferralInvite()
}

data class FriendDetailSaveResult(
    val updated: FriendLiteItem,
    val overview: FriendsOverviewSnapshot,
)

class FriendDetailUseCase(
    private val repository: FriendsRepository,
) {
    suspend fun loadProfile(userId: String): FriendLiteItem =
        repository.getFriendProfile(userId.requireFriendId())

    suspend fun loadSharedContent(userId: String): List<SocialHubSharedContentItemDto> =
        repository.loadFriendSharedContent(userId.requireFriendId())

    suspend fun save(
        userId: String,
        privateNote: String,
        circleIds: List<String>,
    ): FriendDetailSaveResult {
        val updated =
            repository.updateRelationship(
                userId = userId.requireFriendId(),
                circleIds = circleIds.map { it.trim() }.filter { it.isNotEmpty() }.distinct(),
                privateNote = privateNote,
            )
        return FriendDetailSaveResult(
            updated = updated,
            overview = repository.refreshOverview(),
        )
    }
}

private fun String.requireFriendId(): String =
    trim().also { require(it.isNotEmpty()) { "userId must not be blank" } }
