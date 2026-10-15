package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import world.empery.mobile.core.network.api.GafChatApi
import world.empery.mobile.core.network.api.GafChatListItemDto
import world.empery.mobile.core.network.api.GafChatListItemLiteDto
import world.empery.mobile.core.network.api.GafMessageDto

class GafChatApiContractsTest {
    private val gson = Gson()

    @Test
    fun chatRoutesMatchBackendPaths() {
        ApiContractPathAssertions.assertGet(GafChatApi::class, "getMe", "gaf-chat/me")
        ApiContractPathAssertions.assertGet(GafChatApi::class, "getChats", "gaf-chat/chats")
        ApiContractPathAssertions.assertGet(GafChatApi::class, "getChatsLite", "gaf-chat/chats/lite")
        ApiContractPathAssertions.assertGet(
            GafChatApi::class,
            "getMessages",
            "gaf-chat/chats/{chatId}/messages",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "sendMessage",
            "gaf-chat/chats/{chatId}/messages",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "markRead",
            "gaf-chat/chats/{chatId}/read",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "uploadPublicKey",
            "gaf-chat/keys/public",
        )
        ApiContractPathAssertions.assertGet(
            GafChatApi::class,
            "getMyPublicKey",
            "gaf-chat/keys/public/me",
        )
        ApiContractPathAssertions.assertGet(
            GafChatApi::class,
            "getUserPublicKey",
            "gaf-chat/keys/public/{userId}",
        )
        ApiContractPathAssertions.assertGet(
            GafChatApi::class,
            "getSessionKeyEnvelope",
            "gaf-chat/chats/{chatId}/session-key",
        )
        ApiContractPathAssertions.assertGet(
            GafChatApi::class,
            "getE2eeStatus",
            "gaf-chat/chats/{chatId}/e2ee",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "proposeE2ee",
            "gaf-chat/chats/{chatId}/e2ee/propose",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "acceptE2ee",
            "gaf-chat/chats/{chatId}/e2ee/accept",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "declineE2ee",
            "gaf-chat/chats/{chatId}/e2ee/decline",
        )
        ApiContractPathAssertions.assertPost(
            GafChatApi::class,
            "disableE2ee",
            "gaf-chat/chats/{chatId}/e2ee/disable",
        )
    }

    @Test
    fun parsesChatListAndMessageDtos() {
        val listJson = """
            [{
              "chat_id": "11111111-1111-1111-1111-111111111111",
              "partner": {"id": "22222222-2222-2222-2222-222222222222", "username": "alice"},
              "unread_count": 2,
              "last_message_preview": "Hi"
            }]
        """.trimIndent()
        val items = gson.fromJson(listJson, Array<GafChatListItemDto>::class.java)
        assertEquals(1, items.size)
        assertEquals(2, items[0].unread_count)

        val msgJson = """
            {
              "id": "33333333-3333-3333-3333-333333333333",
              "chat_id": "11111111-1111-1111-1111-111111111111",
              "sender_id": "22222222-2222-2222-2222-222222222222",
              "body": "Hello",
              "created_at": "2026-06-02T10:00:00+00:00"
            }
        """.trimIndent()
        val msg = gson.fromJson(msgJson, GafMessageDto::class.java)
        assertEquals("Hello", msg.body)
        assertFalse(msg.deleted_for_sender)
    }

    @Test
    fun parsesChatListLiteSystemAccountFlag() {
        val liteJson = """
            [{
              "chat_id": "11111111-1111-1111-1111-111111111111",
              "partner": {
                "id": "22222222-2222-2222-2222-222222222222",
                "username": "elite_system",
                "avatar_url": "https://cdn.example/avatar.png",
                "full_name": "Elite System",
                "is_system_account": true
              },
              "unread_count": 1
            }]
        """.trimIndent()
        val items = gson.fromJson(liteJson, Array<GafChatListItemLiteDto>::class.java)
        assertEquals(1, items.size)
        assertEquals(true, items[0].partner.is_system_account)
        assertEquals("https://cdn.example/avatar.png", items[0].partner.avatar_url)
    }
}
