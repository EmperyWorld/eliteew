package world.empery.mobile.core.network.api

import com.google.gson.JsonElement
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

data class GafChatMeDto(
    val user_id: String,
)

/** Other participant in a 1:1 chat; mirrors backend `ChatPartner`. */
data class GafChatPartnerDto(
    val id: String,
    val username: String? = null,
    val avatar_url: String? = null,
    val full_name: String? = null,
    val bio: String? = null,
    val is_trusted: Boolean = false,
    val admin_badge_label: String? = null,
    val admin_badge_hint: String? = null,
    val is_system_account: Boolean = false,
    val is_muted: Boolean = false,
    val is_blocked: Boolean = false,
    val blocked_by_partner: Boolean = false,
)

/** Row from `GET /gaf-chat/chats`; mirrors `ChatListItem`. */
data class GafChatListItemDto(
    val chat_id: String,
    val partner: GafChatPartnerDto,
    val last_message_at: String? = null,
    val last_message_preview: String? = null,
    val unread_count: Int = 0,
    val partner_last_read_message_id: String? = null,
)

/** Smaller partner card from `GET /gaf-chat/chats/lite`. */
data class GafChatPartnerLiteDto(
    val id: String,
    val username: String? = null,
    val avatar_url: String? = null,
    val full_name: String? = null,
    val is_system_account: Boolean = false,
    val is_muted: Boolean = false,
    val is_blocked: Boolean = false,
    val blocked_by_partner: Boolean = false,
)

/** Row from `GET /gaf-chat/chats/lite`; same ordering as `/chats`, lighter partner payload. */
data class GafChatListItemLiteDto(
    val chat_id: String,
    val partner: GafChatPartnerLiteDto,
    val last_message_at: String? = null,
    val last_message_preview: String? = null,
    val unread_count: Int = 0,
    val partner_last_read_message_id: String? = null,
    val e2ee_status: String? = null,
)

/** One message; mirrors `MessageItem` (E2E ciphertext fields optional). */
data class GafMessageDto(
    val id: String,
    val chat_id: String? = null,
    val sender_id: String = "",
    val body: String = "",
    val created_at: String? = null,
    val attachment_content_id: String? = null,
    val attachment_name: String? = null,
    val attachment_mime_type: String? = null,
    val attachment_size: Long? = null,
    val edited_at: String? = null,
    val reply_to_message_id: String? = null,
    val deleted_for_sender: Boolean = false,
    val deleted_for_recipient: Boolean = false,
    val algorithm: String? = null,
    val encryption_version: String? = null,
    val body_ciphertext: String? = null,
    val nonce: String? = null,
    val e2ee_session_key_envelope: String? = null,
    val attachment_recipient_saved_id: String? = null,
    /** System / structured messages may have no plain body or attachment id yet — keep row for UI. */
    val metadata: JsonElement? = null,
)

/** Plaintext send path; E2E fields mirror `SendMessageBody` (router requires at least body or ciphertext). */
data class GafSendMessageBody(
    val body: String? = null,
    val attachment_content_id: String? = null,
    val reply_to_message_id: String? = null,
    val e2e_ciphertext: String? = null,
    val e2e_nonce: String? = null,
    val e2e_algorithm: String? = null,
    val e2e_encryption_version: String? = null,
    val e2e_session_key_for_recipient: String? = null,
    val e2e_session_key_for_self: String? = null,
)

data class GafPublicKeyUploadBody(
    val public_key_pem: String,
    val algorithm: String,
)

data class GafPublicKeyInfoDto(
    val has_key: Boolean,
    val algorithm: String? = null,
    val public_key_pem: String? = null,
)

data class GafSessionKeyEnvelopeDto(
    val chat_id: String,
    val encrypted_key_payload: String,
)

/** Mirrors `E2eeConsentStatusResponse` from GET `/gaf-chat/chats/{id}/e2ee`. */
data class GafE2eeConsentStatusDto(
    val chat_id: String,
    val status: String,
    val ready: Boolean = false,
    val requested_by_user_id: String? = null,
)

data class GafMarkReadBody(
    val up_to_message_id: String? = null,
)

data class GafEditMessageBody(
    val body: String,
)

data class GafByUsernameBody(
    val username: String,
)

/** Mirrors `ChatByUsernameResponse`. */
data class GafChatByUsernameResponseDto(
    val chat_id: String,
    val partner: GafChatPartnerDto,
)

data class GafUserSearchItemDto(
    val id: String,
    val username: String? = null,
    val display_name: String? = null,
    val full_name: String? = null,
    val avatar_url: String? = null,
)

/** Mutating GAF endpoints return `{"status":"ok"}`. */
data class GafOkStatusResponse(
    val status: String,
)

/**
 * Upload-contract DTOs for future chat media pipeline.
 * Current UI uses text references until backend attachment endpoints are enabled.
 */
data class GafAttachmentInitBody(
    val file_name: String,
    val mime_type: String,
    val size_bytes: Long? = null,
)

data class GafAttachmentInitResponse(
    val upload_id: String,
    val upload_url: String,
    val upload_headers: Map<String, String>? = null,
    val expires_at: String? = null,
)

data class GafAttachmentFinalizeBody(
    val upload_id: String,
    val caption: String? = null,
)

data class GafAttachmentFinalizeResponse(
    val message: GafMessageDto? = null,
    val attachment_url: String? = null,
)

data class GafAcceptAttachmentResponse(
    val content_id: String,
    val already_saved: Boolean = false,
)

interface GafChatApi {
    @GET("gaf-chat/me")
    suspend fun getMe(): GafChatMeDto

    @GET("gaf-chat/chats")
    suspend fun getChats(): List<GafChatListItemDto>

    @GET("gaf-chat/chats/lite")
    suspend fun getChatsLite(): List<GafChatListItemLiteDto>

    @GET("gaf-chat/chats/{chatId}/messages")
    suspend fun getMessages(
        @Path("chatId") chatId: String,
        @Query("limit") limit: Int = 50,
        @Query("before") beforeMessageId: String? = null,
        @Query("after") afterMessageId: String? = null,
    ): List<GafMessageDto>

    @POST("gaf-chat/chats/{chatId}/messages")
    suspend fun sendMessage(
        @Path("chatId") chatId: String,
        @Body body: GafSendMessageBody,
    ): GafMessageDto

    @POST("gaf-chat/keys/public")
    suspend fun uploadPublicKey(
        @Body body: GafPublicKeyUploadBody,
    ): GafPublicKeyInfoDto

    @GET("gaf-chat/keys/public/me")
    suspend fun getMyPublicKey(): GafPublicKeyInfoDto

    @GET("gaf-chat/keys/public/{userId}")
    suspend fun getUserPublicKey(
        @Path("userId") userId: String,
    ): GafPublicKeyInfoDto

    @GET("gaf-chat/chats/{chatId}/session-key")
    suspend fun getSessionKeyEnvelope(
        @Path("chatId") chatId: String,
    ): GafSessionKeyEnvelopeDto?

    @GET("gaf-chat/chats/{chatId}/e2ee")
    suspend fun getE2eeStatus(
        @Path("chatId") chatId: String,
    ): GafE2eeConsentStatusDto

    @POST("gaf-chat/chats/{chatId}/e2ee/propose")
    suspend fun proposeE2ee(
        @Path("chatId") chatId: String,
    ): GafE2eeConsentStatusDto

    @POST("gaf-chat/chats/{chatId}/e2ee/accept")
    suspend fun acceptE2ee(
        @Path("chatId") chatId: String,
    ): GafE2eeConsentStatusDto

    @POST("gaf-chat/chats/{chatId}/e2ee/decline")
    suspend fun declineE2ee(
        @Path("chatId") chatId: String,
    ): GafE2eeConsentStatusDto

    @POST("gaf-chat/chats/{chatId}/e2ee/disable")
    suspend fun disableE2ee(
        @Path("chatId") chatId: String,
    ): GafE2eeConsentStatusDto

    @PATCH("gaf-chat/chats/{chatId}/messages/{messageId}")
    suspend fun editMessage(
        @Path("chatId") chatId: String,
        @Path("messageId") messageId: String,
        @Body body: GafEditMessageBody,
    ): GafMessageDto

    @DELETE("gaf-chat/chats/{chatId}/messages/{messageId}")
    suspend fun deleteMessage(
        @Path("chatId") chatId: String,
        @Path("messageId") messageId: String,
        @Query("for_me_only") forMeOnly: Boolean = false,
    ): GafOkStatusResponse

    @POST("gaf-chat/chats/{chatId}/read")
    suspend fun markRead(
        @Path("chatId") chatId: String,
        @Body body: GafMarkReadBody = GafMarkReadBody(),
    ): GafOkStatusResponse

    @Streaming
    @GET("gaf-chat/chats/{chatId}/messages/{messageId}/attachment")
    suspend fun downloadAttachment(
        @Path("chatId") chatId: String,
        @Path("messageId") messageId: String,
    ): ResponseBody

    @POST("gaf-chat/chats/{chatId}/messages/{messageId}/accept-attachment")
    suspend fun acceptAttachment(
        @Path("chatId") chatId: String,
        @Path("messageId") messageId: String,
    ): GafAcceptAttachmentResponse

    @POST("gaf-chat/chats/{chatId}/clear")
    suspend fun clearChatHistory(
        @Path("chatId") chatId: String,
    ): GafOkStatusResponse

    @POST("gaf-chat/chats/{chatId}/archive")
    suspend fun archiveChat(
        @Path("chatId") chatId: String,
    ): GafOkStatusResponse

    @DELETE("gaf-chat/chats/{chatId}")
    suspend fun deleteChat(
        @Path("chatId") chatId: String,
    ): GafOkStatusResponse

    @POST("gaf-chat/chats/by-username")
    suspend fun getOrCreateChatByUsername(
        @Body body: GafByUsernameBody,
    ): GafChatByUsernameResponseDto

    @GET("gaf-chat/users/search")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20,
    ): List<GafUserSearchItemDto>
}

interface GafChatAttachmentApi {
    @POST("gaf-chat/chats/{chatId}/attachments/init")
    suspend fun initAttachmentUpload(
        @Path("chatId") chatId: String,
        @Body body: GafAttachmentInitBody,
    ): GafAttachmentInitResponse

    @POST("gaf-chat/chats/{chatId}/attachments/finalize")
    suspend fun finalizeAttachmentUpload(
        @Path("chatId") chatId: String,
        @Body body: GafAttachmentFinalizeBody,
    ): GafAttachmentFinalizeResponse
}
