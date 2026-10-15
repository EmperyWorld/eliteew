package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.storage.ChatEntity

class ChatUnreadAggregationTest {
    @Test
    fun totalChatUnreadCount_sumsPerChatUnread_notChatCount() {
        val chats =
            listOf(
                chat(id = "a", unread = 3),
                chat(id = "b", unread = 0),
                chat(id = "c", unread = 7),
            )
        // SSOT is message sum (10), not "chats with unread" (2).
        assertEquals(10, totalChatUnreadCount(chats))
        assertEquals(2, chats.count { it.unreadCount > 0 })
    }

    @Test
    fun totalChatUnreadCount_coercesNegativeAndEmpty() {
        assertEquals(0, totalChatUnreadCount(emptyList()))
        assertEquals(
            4,
            totalChatUnreadCount(
                listOf(
                    chat(id = "a", unread = -2),
                    chat(id = "b", unread = 4),
                ),
            ),
        )
    }

    private fun chat(
        id: String,
        unread: Int,
    ): ChatEntity =
        ChatEntity(
            chatId = id,
            unreadCount = unread,
            lastMessagePreview = null,
        )
}
