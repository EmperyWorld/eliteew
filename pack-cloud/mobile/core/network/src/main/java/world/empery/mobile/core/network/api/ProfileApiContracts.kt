/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for profile, preferences (call_target), and push token endpoints.
 *
 * Invariants:
 * - video_calls.call_target is patched via profile/preferences (shared with web Связи → Телефон).
 *
 * Related:
 * - ProfileRepository, MobileProfileRepository
 */
package world.empery.mobile.core.network.api

import com.google.gson.annotations.SerializedName
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.PUT
import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.DELETE
import retrofit2.http.POST
import retrofit2.http.Query
import okhttp3.MultipartBody
import retrofit2.Response

/** `GET profile/me` — mirrors `UserProfileResponse` (subset used by mobile; extra JSON keys ignored by Gson). */
data class ProfileMeResponse(
    val id: String,
    val email: String,
    val username: String,
    val full_name: String? = null,
    val avatar_url: String? = null,
)

/**
 * One notification-center row for cross-device sync.
 * Server JSON uses [timestamp] and boolean [read]; the property [created_at] is bound via @[SerializedName].
 * [read_at] is not part of the API schema — kept for app-local PUT snapshots only (Gson may emit it; server ignores extras).
 */
data class NotificationCenterItemDto(
    val id: String?,
    val source: String?,
    val type: String?,
    val title: String?,
    val message: String?,
    @SerializedName("timestamp")
    val created_at: String?,
    val read: Boolean? = null,
    val read_at: String? = null,
    val persistent: Boolean? = false,
    @SerializedName("expiresAt")
    val expiresAt: String? = null,
)

data class NotificationCenterGetResponse(
    val items: List<NotificationCenterItemDto> = emptyList(),
    val updated_at: String?,
)

data class NotificationCenterDeltaResponse(
    val items: List<NotificationCenterItemDto> = emptyList(),
    val updated_at: String? = null,
    val unchanged: Boolean = false,
)

data class NotificationCenterPutBody(
    val items: List<NotificationCenterItemDto>,
)

/** `PUT profile/mobile-push-token` — registers FCM token (server may log only until persistence lands). */
data class MobilePushTokenBody(
    val token: String,
    val platform: String = "android",
    val device_id: String? = null,
)

data class ProfilePrivacyDto(
    val discoverability: String,
    val avatar_visibility: String,
    val avatar_circle_id: String? = null,
    val full_name_visibility: String,
    val full_name_circle_id: String? = null,
    val bio_visibility: String,
    val bio_circle_id: String? = null,
    val updated_at: String? = null,
)

data class AvatarUploadResponseDto(
    val avatar_url: String,
    val thumbnail_256_url: String? = null,
    val thumbnail_64_url: String? = null,
    val content_id: String? = null,
    val file_size: Int,
    val mime_type: String,
    val created_at: String? = null,
)

data class ProfilePrivacyUpdateBody(
    val discoverability: String? = null,
    val avatar_visibility: String? = null,
    val avatar_circle_id: String? = null,
    val full_name_visibility: String? = null,
    val full_name_circle_id: String? = null,
    val bio_visibility: String? = null,
    val bio_circle_id: String? = null,
)

/** Subset of `GET/PATCH profile/preferences` used for video call routing. */
data class VideoCallsPreferencesDto(
    val call_target: String? = null,
)

data class UserPreferencesDto(
    val video_calls: VideoCallsPreferencesDto? = null,
)

data class UserPreferencesUpdateBody(
    val video_calls: VideoCallsPreferencesDto? = null,
)

interface ProfileApi {
    @GET("profile/me")
    suspend fun getMe(): ProfileMeResponse

    @GET("profile/me")
    suspend fun getMeConditional(
        @Header("If-None-Match") ifNoneMatch: String?,
    ): Response<ProfileMeResponse>

    @GET("profile/me/privacy")
    suspend fun getPrivacy(): ProfilePrivacyDto

    @PATCH("profile/me/privacy")
    suspend fun updatePrivacy(@Body body: ProfilePrivacyUpdateBody): ProfilePrivacyDto

    @GET("profile/preferences")
    suspend fun getPreferences(): UserPreferencesDto

    @PATCH("profile/preferences")
    suspend fun updatePreferences(@Body body: UserPreferencesUpdateBody): UserPreferencesDto

    @GET("profile/notification-center")
    suspend fun getNotificationCenter(): NotificationCenterGetResponse

    @GET("profile/notification-center/delta")
    suspend fun getNotificationCenterDelta(
        @Query("since") since: String,
    ): NotificationCenterDeltaResponse

    @PUT("profile/notification-center")
    suspend fun putNotificationCenter(@Body body: NotificationCenterPutBody): NotificationCenterGetResponse

    @PUT("profile/mobile-push-token")
    suspend fun putMobilePushToken(@Body body: MobilePushTokenBody)

    @DELETE("profile/mobile-push-token")
    suspend fun deleteMobilePushToken(@Body body: MobilePushTokenBody)

    @Multipart
    @POST("profile/avatar")
    suspend fun uploadAvatar(@Part file: MultipartBody.Part): AvatarUploadResponseDto

    @DELETE("profile/avatar")
    suspend fun deleteAvatar()
}
