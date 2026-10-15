package world.empery.mobile.core.network.api

import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/** Ответы зеркалят `api/video_calls/schemas.py`. */
data class VideoCallJoinResponseDto(
    val call_id: String,
    val chat_id: String? = null,
    val room_name: String,
    val status: String,
    val provider: String? = null,
    val meet_base_url: String? = null,
    val jwt: String? = null,
    val join_url: String? = null,
    val expires_at: String? = null,
    val call_kind: String? = null,
    val invited_user_ids: List<String>? = null,
    val reused_existing: Boolean? = null,
    val awaiting_accept: Boolean? = null,
)

data class GroupGafVideoCallCreateRequestDto(
    val additional_participant_ids: List<String>,
)

data class VideoCallEndResponseDto(
    val status: String? = null,
    val call_id: String,
)

interface VideoCallsApi {
    @POST("video-calls/gaf-chats/{chatId}")
    suspend fun createGafVideoCall(
        @Path("chatId") chatId: String,
        @Body body: Map<String, String>,
    ): VideoCallJoinResponseDto

    @POST("video-calls/gaf-chats/{chatId}/group")
    suspend fun createGafGroupVideoCall(
        @Path("chatId") chatId: String,
        @Body body: GroupGafVideoCallCreateRequestDto,
    ): VideoCallJoinResponseDto

    @POST("video-calls/{callId}/join")
    suspend fun joinVideoCall(
        @Path("callId") callId: String,
        @Body body: Map<String, String>,
    ): VideoCallJoinResponseDto

    @POST("video-calls/{callId}/end")
    suspend fun endVideoCall(
        @Path("callId") callId: String,
        @Body body: Map<String, String>,
    ): VideoCallEndResponseDto
}
