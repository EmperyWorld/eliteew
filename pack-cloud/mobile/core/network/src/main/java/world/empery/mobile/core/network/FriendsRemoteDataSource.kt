/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Core-network transport boundary for the Friends feature and its Retrofit adapter.
 *
 * Invariants:
 * - Conditional overview reads distinguish 304 from a fresh payload.
 * - Non-success responses never become empty successful payloads.
 *
 * Related:
 * - api/FriendsApiContracts.kt
 * - feature.friends.data.DefaultFriendsRepository
 */
package world.empery.mobile.core.network

import retrofit2.HttpException
import world.empery.mobile.core.network.api.FriendCircleCreateBodyDto
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendCircleUpdateBodyDto
import world.empery.mobile.core.network.api.FriendProfileDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.network.api.FriendRelationshipUpdateBodyDto
import world.empery.mobile.core.network.api.FriendReportBodyDto
import world.empery.mobile.core.network.api.FriendRequestSendBody
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.FriendsApi
import world.empery.mobile.core.network.api.FriendsOverviewResponse
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto

sealed interface FriendsOverviewRemoteResult {
    data object NotModified : FriendsOverviewRemoteResult

    data class Fresh(
        val overview: FriendsOverviewResponse,
        val etag: String?,
    ) : FriendsOverviewRemoteResult
}

interface FriendsRemoteDataSource {
    suspend fun loadOverview(ifNoneMatch: String?): FriendsOverviewRemoteResult

    suspend fun acceptRequest(requestId: String)

    suspend fun rejectRequest(requestId: String)

    suspend fun cancelRequest(requestId: String)

    suspend fun sendRequest(username: String)

    suspend fun searchUsers(query: String): List<FriendSearchCandidateDto>

    suspend fun sendRequestToUser(userId: String)

    suspend fun getFriendProfile(userId: String): FriendProfileDto

    suspend fun updateRelationship(
        userId: String,
        body: FriendRelationshipUpdateBodyDto,
    ): FriendProfileDto

    suspend fun reportUser(
        userId: String,
        body: FriendReportBodyDto,
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

class RetrofitFriendsRemoteDataSource(
    private val api: FriendsApi,
) : FriendsRemoteDataSource {
    override suspend fun loadOverview(ifNoneMatch: String?): FriendsOverviewRemoteResult {
        val response = api.getOverviewConditional(ifNoneMatch)
        if (HttpEtagSupport.isNotModified(response)) {
            return FriendsOverviewRemoteResult.NotModified
        }
        if (!response.isSuccessful) {
            throw HttpException(response)
        }
        val overview =
            response.body()
                ?: throw IllegalStateException("friends/overview returned empty body for ${response.code()}")
        return FriendsOverviewRemoteResult.Fresh(
            overview = overview,
            etag = HttpEtagSupport.parseEtag(response),
        )
    }

    override suspend fun acceptRequest(requestId: String) {
        api.acceptRequest(requestId)
    }

    override suspend fun rejectRequest(requestId: String) {
        api.rejectRequest(requestId)
    }

    override suspend fun cancelRequest(requestId: String) {
        api.cancelRequest(requestId)
    }

    override suspend fun sendRequest(username: String) {
        api.sendRequest(FriendRequestSendBody(username))
    }

    override suspend fun searchUsers(query: String): List<FriendSearchCandidateDto> = api.searchUsers(query)

    override suspend fun sendRequestToUser(userId: String) {
        api.sendRequestToUser(userId)
    }

    override suspend fun getFriendProfile(userId: String): FriendProfileDto = api.getFriendProfile(userId)

    override suspend fun updateRelationship(
        userId: String,
        body: FriendRelationshipUpdateBodyDto,
    ): FriendProfileDto = api.updateRelationship(userId, body)

    override suspend fun reportUser(
        userId: String,
        body: FriendReportBodyDto,
    ) {
        api.reportUser(userId, body)
    }

    override suspend fun loadSocialHubInbox(): List<SocialHubActionInboxItemDto> =
        api.getSocialHubActionInbox().items

    override suspend fun loadFriendSharedContent(userId: String): List<SocialHubSharedContentItemDto> =
        api.getSocialHubSharedContent(userId).items

    override suspend fun loadPrivacyPreview(): SocialHubPrivacyPreviewResponseDto =
        api.getSocialHubPrivacyPreview()

    override suspend fun loadReferralInvite(): FriendReferralInviteResponseDto =
        api.getFriendReferralInvite()

    override suspend fun createCircle(name: String): FriendCircleItemDto =
        api.createCircle(FriendCircleCreateBodyDto(name))

    override suspend fun deleteCircle(circleId: String) {
        api.deleteCircle(circleId)
    }

    override suspend fun renameCircle(
        circleId: String,
        name: String,
    ): FriendCircleItemDto =
        api.updateCircle(
            circleId,
            FriendCircleUpdateBodyDto(name = name),
        )

    override suspend fun removeFriend(userId: String) {
        api.removeFriend(userId)
    }
}
