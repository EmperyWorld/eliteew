/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for chat list sort order and activity timestamp formatting.
 *
 * Invariants:
 * - Pinned chats stay above non-pinned; within each group newest activity is first.
 *
 * Related:
 * - ChatModels.kt sortedForChatList, formatChatListActivityTime
 */
package feature.chat

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.core.storage.ChatEntity
import java.time.Instant
import java.time.ZoneId

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ChatListSortTest {

    private fun chat(
        id: String,
        unread: Int = 0,
        lastAt: String? = null,
    ): ChatEntity =
        ChatEntity(
            chatId = id,
            unreadCount = unread,
            lastMessagePreview = "preview-$id",
            lastMessageAt = lastAt,
        )

    @Test
    fun sortedForChatList_ordersByLastActivityNewestFirst() {
        val items =
            listOf(
                chat("old", lastAt = "2026-05-20T10:00:00Z"),
                chat("new", lastAt = "2026-05-27T12:00:00Z"),
                chat("mid", lastAt = "2026-05-25T08:00:00Z"),
            )
        val sorted = items.sortedForChatList(emptyMap())
        assertEquals(listOf("new", "mid", "old"), sorted.map { it.chatId })
    }

    @Test
    fun sortedForChatList_systemAccountFirstEvenWhenNotPinned() {
        val flags =
            mapOf(
                "fresh-pin" to ChatLocalFlags(pinned = true),
            )
        val items =
            listOf(
                chat("fresh-pin", lastAt = "2026-05-27T18:00:00Z"),
                chat("elite-system", lastAt = "2026-05-01T00:00:00Z").copy(isSystemAccount = true),
            )
        val sorted = items.sortedForChatList(flags)
        assertEquals("elite-system", sorted.first().chatId)
    }

    @Test
    fun resolveChatPartnerIsSystemAccount_usernameFallback() {
        assertTrue(resolveChatPartnerIsSystemAccount(isSystemAccount = false, username = "elite_system"))
        assertTrue(resolveChatPartnerIsSystemAccount(isSystemAccount = true, username = "other"))
        assertEquals(false, resolveChatPartnerIsSystemAccount(isSystemAccount = false, username = "alice"))
    }

    @Test
    fun sortedForChatList_pinsFirstThenActivity() {
        val flags =
            mapOf(
                "old-pin" to ChatLocalFlags(pinned = true),
            )
        val items =
            listOf(
                chat("fresh", lastAt = "2026-05-27T18:00:00Z"),
                chat("old-pin", lastAt = "2026-05-01T00:00:00Z"),
            )
        val sorted = items.sortedForChatList(flags)
        assertEquals(listOf("old-pin", "fresh"), sorted.map { it.chatId })
    }

    @Test
    fun sortedForChatList_chatsWithoutTimestampSortLast() {
        val items =
            listOf(
                chat("dated", lastAt = "2026-05-27T10:00:00Z"),
                chat("empty"),
            )
        val sorted = items.sortedForChatList(emptyMap())
        assertEquals("dated", sorted.first().chatId)
        assertEquals("empty", sorted.last().chatId)
    }

    @Test
    fun formatChatListActivityTime_justNowForRecentMessage() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val now = Instant.parse("2026-05-27T12:00:30Z")
        val label =
            formatChatListActivityTime(
                context = ctx,
                lastMessageAt = "2026-05-27T12:00:00Z",
                zone = ZoneId.of("UTC"),
                now = now,
            )
        assertTrue(label.isNotBlank())
        assertEquals(ctx.getString(R.string.chat_list_time_just_now), label)
    }

    @Test
    fun formatChatListActivityTime_unknownWhenBlank() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val label = formatChatListActivityTime(ctx, lastMessageAt = null)
        assertEquals(ctx.getString(R.string.chat_list_time_unknown), label)
    }
}
