/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable boundary fakes for Friends use-case, repository, and ViewModel tests.
 *
 * Invariants:
 * - Tests can observe every mutation without mocking implementation internals.
 *
 * Related:
 * - FriendsUseCasesTest.kt
 * - FriendsTabViewModelTest.kt
 */
package feature.friends

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import world.empery.mobile.core.network.FriendsOverviewRemoteResult
import world.empery.mobile.core.network.FriendsRemoteDataSource
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendProfileDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.network.api.FriendRelationshipUpdateBodyDto
import world.empery.mobile.core.network.api.FriendReportBodyDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto

internal val emptyOverview =
    FriendsOverviewSnapshot(
        friends = emptyList(),
        incomingRequests = emptyList(),
        sentRequests = emptyList(),
        circles = emptyList(),
    )

internal open class FakeFriendsRepository : FriendsRepository {
    var cachedOverview: FriendsOverviewSnapshot = emptyOverview
    var refreshedOverview: FriendsOverviewSnapshot = emptyOverview
    var refreshError: Throwable? = null
    var searchResult: List<FriendSearchCandidateDto> = emptyList()
    var friendProfile = FriendLiteItem("friend-1", "alice", "Alice", null)
    var relationshipResult: FriendLiteItem = friendProfile
    var inbox: List<SocialHubActionInboxItemDto> = emptyList()
    var privacy = SocialHubPrivacyPreviewResponseDto("friends")
    var referral = FriendReferralInviteResponseDto("code", "https://example.test/i", "Alice", "Invite")
    var sharedContent: List<SocialHubSharedContentItemDto> = emptyList()
    var mutationGate: (suspend () -> Unit)? = null
    var refreshGate: (suspend () -> Unit)? = null
    val calls = mutableListOf<String>()

    override suspend fun loadFriendsFromCache(): List<FriendLiteItem> {
        calls += "cacheFriends"
        return cachedOverview.friends
    }

    override suspend fun loadOverviewFromCache(): FriendsOverviewSnapshot {
        calls += "cacheOverview"
        return cachedOverview
    }

    override suspend fun refreshOverview(): FriendsOverviewSnapshot {
        calls += "refresh"
        refreshGate?.invoke()
        refreshError?.let { throw it }
        return refreshedOverview
    }

    override suspend fun acceptRequest(requestId: String) = mutate("accept:$requestId")

    override suspend fun rejectRequest(requestId: String) = mutate("reject:$requestId")

    override suspend fun cancelRequest(requestId: String) = mutate("cancel:$requestId")

    override suspend fun sendRequest(username: String) = mutate("sendUsername:$username")

    override suspend fun searchUsers(query: String): List<FriendSearchCandidateDto> {
        calls += "search:$query"
        return searchResult
    }

    override suspend fun sendRequestToUser(userId: String) = mutate("sendUser:$userId")

    override suspend fun getFriendProfile(userId: String): FriendLiteItem {
        calls += "profile:$userId"
        return friendProfile
    }

    override suspend fun updateRelationship(
        userId: String,
        isFavorite: Boolean?,
        isMuted: Boolean?,
        isBlocked: Boolean?,
        shareActivityWithFriend: Boolean?,
        circleIds: List<String>?,
        privateNote: String?,
    ): FriendLiteItem {
        calls +=
            "relationship:$userId:$isFavorite:$isMuted:$isBlocked:" +
                "$shareActivityWithFriend:${circleIds.orEmpty()}:$privateNote"
        mutationGate?.invoke()
        return relationshipResult
    }

    override suspend fun reportUser(
        userId: String,
        reason: String,
        details: String?,
    ) = mutate("report:$userId:$reason:$details")

    override suspend fun loadSocialHubInbox(): List<SocialHubActionInboxItemDto> {
        calls += "inbox"
        return inbox
    }

    override suspend fun loadFriendSharedContent(userId: String): List<SocialHubSharedContentItemDto> {
        calls += "shared:$userId"
        return sharedContent
    }

    override suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto {
        calls += "privacy"
        return privacy
    }

    override suspend fun loadReferralInvite(): FriendReferralInviteResponseDto {
        calls += "referral"
        return referral
    }

    override suspend fun createCircle(name: String): FriendCircleItemDto {
        calls += "createCircle:$name"
        return FriendCircleItemDto("circle-created", name)
    }

    override suspend fun deleteCircle(circleId: String) = mutate("deleteCircle:$circleId")

    override suspend fun renameCircle(
        circleId: String,
        name: String,
    ): FriendCircleItemDto {
        calls += "renameCircle:$circleId:$name"
        return FriendCircleItemDto(circleId, name)
    }

    override suspend fun removeFriend(userId: String) = mutate("removeFriend:$userId")

    private suspend fun mutate(call: String) {
        calls += call
        mutationGate?.invoke()
    }
}

internal open class FakeFriendsRemoteDataSource : FriendsRemoteDataSource {
    var overviewResult: FriendsOverviewRemoteResult = FriendsOverviewRemoteResult.NotModified
    var loadOverviewError: Throwable? = null
    var lastIfNoneMatch: String? = null

    override suspend fun loadOverview(ifNoneMatch: String?): FriendsOverviewRemoteResult {
        lastIfNoneMatch = ifNoneMatch
        loadOverviewError?.let { throw it }
        return overviewResult
    }

    override suspend fun acceptRequest(requestId: String) = Unit

    override suspend fun rejectRequest(requestId: String) = Unit

    override suspend fun cancelRequest(requestId: String) = Unit

    override suspend fun sendRequest(username: String) = Unit

    override suspend fun searchUsers(query: String): List<FriendSearchCandidateDto> = emptyList()

    override suspend fun sendRequestToUser(userId: String) = Unit

    override suspend fun getFriendProfile(userId: String): FriendProfileDto =
        FriendProfileDto(userId, null, null, null)

    override suspend fun updateRelationship(
        userId: String,
        body: FriendRelationshipUpdateBodyDto,
    ): FriendProfileDto = FriendProfileDto(userId, null, null, null)

    override suspend fun reportUser(
        userId: String,
        body: FriendReportBodyDto,
    ) = Unit

    override suspend fun loadSocialHubInbox(): List<SocialHubActionInboxItemDto> = emptyList()

    override suspend fun loadFriendSharedContent(userId: String): List<SocialHubSharedContentItemDto> =
        emptyList()

    override suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto =
        SocialHubPrivacyPreviewResponseDto("friends")

    override suspend fun loadReferralInvite(): FriendReferralInviteResponseDto =
        FriendReferralInviteResponseDto("code", "https://example.test/i", "Alice", "Invite")

    override suspend fun createCircle(name: String): FriendCircleItemDto =
        FriendCircleItemDto("circle", name)

    override suspend fun deleteCircle(circleId: String) = Unit

    override suspend fun renameCircle(
        circleId: String,
        name: String,
    ): FriendCircleItemDto = FriendCircleItemDto(circleId, name)

    override suspend fun removeFriend(userId: String) = Unit
}
