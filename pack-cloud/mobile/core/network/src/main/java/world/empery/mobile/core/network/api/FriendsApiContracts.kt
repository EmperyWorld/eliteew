/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for Social Hub friends graph and privacy-safe read models.
 *
 * Invariants:
 * - Feed/inbox/shared-content rows are summaries only; no private notes or message bodies.
 * - Referral invite URL is server-generated; client must not fabricate share links.
 *
 * Related:
 * - api/routers/friends.py, api/routers/social_hub.py
 * - documentation/api/ANDROID-API-CONTRACTS.md
 */
package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.Response
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

data class FriendCircleItemDto(
    val id: String,
    val name: String,
    val members_count: Int = 0,
    val sort_order: Int = 0,
    val color: String? = null,
    val icon: String? = null,
)

data class FriendsOverviewStatsDto(
    val friends_count: Int,
    val incoming_requests_count: Int,
    val sent_requests_count: Int,
)

/** Mirrors `FriendsOverviewResponse`; [circles] and [stats] are optional on the wire for older clients. */
data class FriendsOverviewResponse(
    val friends: List<FriendUserDto>,
    val incoming_requests: List<FriendRequestDto>,
    val sent_requests: List<FriendRequestDto>,
    val circles: List<FriendCircleItemDto> = emptyList(),
    val stats: FriendsOverviewStatsDto? = null,
)

/** Mirrors `FriendUser` (mobile may ignore social flags). */
data class FriendUserDto(
    val id: String,
    val username: String?,
    val full_name: String?,
    val avatar_url: String?,
    val is_favorite: Boolean = false,
    val is_muted: Boolean = false,
    val is_blocked: Boolean = false,
    val share_activity_with_friend: Boolean = true,
    val activity_visible_to_current_user: Boolean = true,
    val last_activity_at: String? = null,
    val last_interaction_at: String? = null,
    val circles: List<FriendCircleItemDto> = emptyList(),
)

data class FriendProfileDto(
    val id: String,
    val username: String?,
    val full_name: String?,
    val avatar_url: String?,
    val is_favorite: Boolean = false,
    val is_muted: Boolean = false,
    val is_blocked: Boolean = false,
    val share_activity_with_friend: Boolean = true,
    val activity_visible_to_current_user: Boolean = true,
    val last_activity_at: String? = null,
    val last_interaction_at: String? = null,
    val circles: List<FriendCircleItemDto> = emptyList(),
    val private_note: String? = null,
    val note_updated_at: String? = null,
    val friendship_created_at: String? = null,
)

/** Incoming row: [from_user_id]; sent row: [to_user_id] — mirrors `IncomingRequestItem` / `SentRequestItem`. */
data class FriendRequestDto(
    val id: String,
    val from_user_id: String? = null,
    val to_user_id: String? = null,
    val username: String? = null,
    val full_name: String? = null,
    val avatar_url: String? = null,
    val created_at: String? = null,
)

data class FriendRequestSendBody(
    val username: String,
)

data class FriendRequestSendResponse(
    val request_id: String,
    val status: String,
)

data class FriendSearchCandidateDto(
    val id: String,
    val username: String? = null,
    val full_name: String? = null,
    val avatar_url: String? = null,
    val relationship_status: String,
    val request_id: String? = null,
)

data class FriendRelationshipUpdateBodyDto(
    val is_favorite: Boolean? = null,
    val is_muted: Boolean? = null,
    val is_blocked: Boolean? = null,
    val share_activity_with_friend: Boolean? = null,
    val circle_ids: List<String>? = null,
    val private_note: String? = null,
)

data class FriendReportBodyDto(
    val reason: String,
    val details: String? = null,
)

data class FriendReportResponseDto(
    val id: String,
    val status: String,
)

data class FriendCircleCreateBodyDto(
    val name: String,
)

data class FriendCircleUpdateBodyDto(
    val name: String? = null,
    val sort_order: Int? = null,
    val color: String? = null,
    val icon: String? = null,
)

data class SocialHubActionInboxItemDto(
    val id: String,
    val type: String,
    val severity: String,
    val title: String,
    val summary: String,
    val count: Int = 0,
    val target_tab: String? = null,
    val target_id: String? = null,
    val created_at: String? = null,
)

data class SocialHubActionInboxResponseDto(
    val items: List<SocialHubActionInboxItemDto> = emptyList(),
)

data class SocialHubPrivacyFieldPreviewDto(
    val visibility: String,
    val circle_id: String? = null,
)

data class SocialHubPrivacyAudiencePreviewDto(
    val id: String,
    val label: String,
    val visible_fields: List<String> = emptyList(),
    val people_count: Int? = null,
)

data class SocialHubPrivacyPreviewResponseDto(
    val discoverability: String,
    val fields: Map<String, SocialHubPrivacyFieldPreviewDto> = emptyMap(),
    val audiences: List<SocialHubPrivacyAudiencePreviewDto> = emptyList(),
    val warnings: List<String> = emptyList(),
)

/** Privacy-safe Social Hub activity row; mirrors `SocialHubFeedItem`. */
data class SocialHubFeedItemDto(
    val id: String,
    val type: String,
    val created_at: String,
    val actor_user_id: String? = null,
    val target_user_id: String? = null,
    val username: String? = null,
    val full_name: String? = null,
    val avatar_url: String? = null,
    val summary: String? = null,
)

data class SocialHubFeedResponseDto(
    val items: List<SocialHubFeedItemDto> = emptyList(),
    val next_cursor: String? = null,
)

/** Friend Card shared-content row; mirrors `SocialHubSharedContentItem`. */
data class SocialHubSharedContentItemDto(
    val id: String,
    val name: String? = null,
    val title: String? = null,
    val content_type: String? = null,
    val mime_type: String? = null,
    val file_size: Long? = null,
    val visibility: String? = null,
    val direction: String,
    val shared_reason: String,
    val created_at: String,
    val updated_at: String,
    val thumbnail_url: String? = null,
)

data class SocialHubSharedContentResponseDto(
    val items: List<SocialHubSharedContentItemDto> = emptyList(),
)

/** Referral invite payload; mirrors `FriendsReferralInviteResponse`. */
data class FriendReferralInviteResponseDto(
    val referral_code: String,
    val invite_url: String,
    val inviter_display_name: String,
    val share_message: String,
)

/** Public referral landing preview; mirrors `FriendsReferralPreviewResponse`. */
data class FriendReferralPreviewResponseDto(
    val valid: Boolean = true,
    val referral_code: String,
    val inviter_display_name: String,
    val invite_url: String,
)

interface FriendsApi {
    @GET("friends/overview")
    suspend fun getOverview(): FriendsOverviewResponse

    @GET("friends/overview")
    suspend fun getOverviewConditional(
        @Header("If-None-Match") ifNoneMatch: String?,
    ): Response<FriendsOverviewResponse>

    @POST("friends/request")
    suspend fun sendRequest(@Body body: FriendRequestSendBody): FriendRequestSendResponse

    @GET("friends/users/search")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("limit") limit: Int = 8,
    ): List<FriendSearchCandidateDto>

    @POST("friends/request/by-user/{userId}")
    suspend fun sendRequestToUser(@Path("userId") userId: String): FriendRequestSendResponse

    @GET("friends/{userId}/profile")
    suspend fun getFriendProfile(@Path("userId") userId: String): FriendProfileDto

    @PATCH("friends/{userId}/relationship")
    suspend fun updateRelationship(
        @Path("userId") userId: String,
        @Body body: FriendRelationshipUpdateBodyDto,
    ): FriendProfileDto

    @POST("friends/{userId}/report")
    suspend fun reportUser(
        @Path("userId") userId: String,
        @Body body: FriendReportBodyDto,
    ): FriendReportResponseDto

    @POST("friends/circles")
    suspend fun createCircle(@Body body: FriendCircleCreateBodyDto): FriendCircleItemDto

    @PATCH("friends/circles/{circleId}")
    suspend fun updateCircle(
        @Path("circleId") circleId: String,
        @Body body: FriendCircleUpdateBodyDto,
    ): FriendCircleItemDto

    @DELETE("friends/circles/{circleId}")
    suspend fun deleteCircle(@Path("circleId") circleId: String)

    @DELETE("friends/{userId}")
    suspend fun removeFriend(@Path("userId") userId: String)

    @GET("social-hub/inbox")
    suspend fun getSocialHubActionInbox(
        @Query("limit") limit: Int = 12,
    ): SocialHubActionInboxResponseDto

    @GET("social-hub/profile/privacy-preview")
    suspend fun getSocialHubPrivacyPreview(): SocialHubPrivacyPreviewResponseDto

    @GET("social-hub/feed")
    suspend fun getSocialHubFeed(
        @Query("limit") limit: Int = 30,
        @Query("cursor") cursor: String? = null,
        @Query("circle_id") circleId: String? = null,
        @Query("types") types: List<String>? = null,
    ): SocialHubFeedResponseDto

    @GET("social-hub/friends/{friendUserId}/shared-content")
    suspend fun getSocialHubSharedContent(
        @Path("friendUserId") friendUserId: String,
        @Query("limit") limit: Int = 12,
    ): SocialHubSharedContentResponseDto

    @GET("friends/referral")
    suspend fun getFriendReferralInvite(): FriendReferralInviteResponseDto

    @GET("friends/referral/preview")
    suspend fun previewFriendReferralCode(
        @Query("code") code: String,
    ): FriendReferralPreviewResponseDto

    @POST("friends/requests/{requestId}/accept")
    suspend fun acceptRequest(@Path("requestId") requestId: String)

    @POST("friends/requests/{requestId}/reject")
    suspend fun rejectRequest(@Path("requestId") requestId: String)

    @POST("friends/requests/{requestId}/cancel")
    suspend fun cancelRequest(@Path("requestId") requestId: String)
}
