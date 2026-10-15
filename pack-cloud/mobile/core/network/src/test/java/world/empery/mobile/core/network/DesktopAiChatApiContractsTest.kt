package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.DesktopAiChatApi
import world.empery.mobile.core.network.api.DesktopAiChatListResponse

class DesktopAiChatApiContractsTest {
    private val gson = Gson()

    @Test
    fun desktopAiChatRoutesMatchBackend() {
        ApiContractPathAssertions.assertGet(DesktopAiChatApi::class, "getChats", "desktop/ai-chat/chats")
        ApiContractPathAssertions.assertPost(DesktopAiChatApi::class, "createChat", "desktop/ai-chat/chats")
        ApiContractPathAssertions.assertGet(
            DesktopAiChatApi::class,
            "getMessages",
            "desktop/ai-chat/chats/{id}/messages",
        )
        ApiContractPathAssertions.assertPost(
            DesktopAiChatApi::class,
            "streamMessage",
            "desktop/ai-chat/chats/{id}/stream",
        )
    }

    @Test
    fun streamBodySerializesWebSearchFlags() {
        val body =
            gson.toJson(
                world.empery.mobile.core.network.api.DesktopAiStreamBody(
                    content = "news",
                    use_tools = true,
                    use_web_search = true,
                ),
            )
        assertEquals(
            """{"content":"news","use_tools":true,"use_web_search":true}""",
            body,
        )
    }
}
