/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for incoming-call participant resolution from chat/friends cache.
 *
 * Invariants:
 * - Avatar from chat partner must resolve even when display name is blank.
 *
 * Related:
 * - IncomingCallLocalResolver.kt
 */
package world.empery.mobile.push

import feature.friends.FriendLiteItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import world.empery.mobile.core.storage.ChatEntity

class IncomingCallLocalResolverTest {
    @Test
    fun build_usesChatPartnerAvatarWhenNameMissing() {
        val chat =
            ChatEntity(
                chatId = "chat-1",
                unreadCount = 0,
                lastMessagePreview = null,
                partnerId = "user-a",
                partnerName = "",
                partnerAvatarUrl = "/media/avatars/a.png",
            )
        val resolved =
            IncomingCallLocalResolver.build(
                chats = listOf(chat),
                friends = emptyList(),
                callId = "call-1",
                chatId = "chat-1",
                callerUserId = "user-a",
                callKind = null,
                participantUserIds = emptyList(),
                fallbackTitle = "Alice",
                fallbackAvatarUrl = null,
            )
        val participant = resolved.participants.firstOrNull()
        assertNotNull(participant)
        assertEquals("/media/avatars/a.png", participant?.avatarUrl)
    }

    @Test
    fun build_appliesFallbackAvatarUrlWhenCacheMiss() {
        val resolved =
            IncomingCallLocalResolver.build(
                chats = emptyList(),
                friends = emptyList(),
                callId = "call-2",
                chatId = null,
                callerUserId = "user-b",
                callKind = null,
                participantUserIds = emptyList(),
                fallbackTitle = "Bob",
                fallbackAvatarUrl = "/media/avatars/bob.png",
            )
        assertEquals("/media/avatars/bob.png", resolved.participants.firstOrNull()?.avatarUrl)
    }

    @Test
    fun build_prefersFriendAvatarWhenChatMissing() {
        val friend =
            FriendLiteItem(
                id = "user-c",
                username = "carol",
                fullName = "Carol",
                avatarUrl = "/media/avatars/c.png",
            )
        val resolved =
            IncomingCallLocalResolver.build(
                chats = emptyList(),
                friends = listOf(friend),
                callId = "call-3",
                chatId = null,
                callerUserId = "user-c",
                callKind = null,
                participantUserIds = emptyList(),
                fallbackTitle = null,
                fallbackAvatarUrl = null,
            )
        assertEquals("/media/avatars/c.png", resolved.participants.firstOrNull()?.avatarUrl)
        assertEquals("Carol", resolved.participants.firstOrNull()?.displayName)
    }
}
