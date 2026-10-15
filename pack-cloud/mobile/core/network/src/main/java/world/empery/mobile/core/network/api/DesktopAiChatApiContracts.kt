package world.empery.mobile.core.network.api

import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Streaming

data class DesktopAiChatSettings(
    val desktop_hero_id: String? = null,
    val desktop_chat_mode: String = "solo",
)

data class DesktopAiChatCreateBody(
    val title: String? = null,
    val system_prompt_override: String? = null,
    val settings: DesktopAiChatSettings? = null,
)

data class DesktopAiChatItem(
    val id: String,
    val title: String,
    val settings: DesktopAiChatSettings?,
    val solo_slot_active: Boolean? = null,
)

data class SoloSlotPurchaseBody(
    val duration_hours: Int,
    val hero_id: String?,
)

data class DesktopAiMessage(
    val id: String,
    val role: String,
    val content: String,
)

data class DesktopAiMessageListResponse(
    val items: List<DesktopAiMessage>,
)

data class DesktopAiStreamBody(
    val content: String,
    /** Solo chat: backend runs web search only when both flags are true. */
    val use_tools: Boolean = false,
    val use_web_search: Boolean = false,
)

data class DesktopAiChatListResponse(
    val items: List<DesktopAiChatItem>,
)

interface DesktopAiChatApi {
    @GET("desktop/ai-chat/chats")
    suspend fun getChats(): DesktopAiChatListResponse

    @POST("desktop/ai-chat/chats")
    suspend fun createChat(@Body body: DesktopAiChatCreateBody): DesktopAiChatItem

    @POST("desktop/ai-chat/chats/{id}/solo-slot")
    suspend fun purchaseSoloSlot(
        @Path("id") chatId: String,
        @Body body: SoloSlotPurchaseBody,
    ): DesktopAiChatItem

    @GET("desktop/ai-chat/chats/{id}/messages")
    suspend fun getMessages(@Path("id") chatId: String): DesktopAiMessageListResponse

    @POST("desktop/ai-chat/chats/{id}/stream")
    @Streaming
    suspend fun streamMessage(
        @Path("id") chatId: String,
        @Body body: DesktopAiStreamBody,
    ): ResponseBody
}
