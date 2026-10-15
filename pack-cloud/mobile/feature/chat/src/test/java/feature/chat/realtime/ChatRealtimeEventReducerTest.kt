/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for ChatRealtimeEventReducer (MA-02.1) — State → Event → State.
 *
 * Related:
 * - ChatRealtimeEventReducer.kt, MainViewModel socket handlers
 */
package feature.chat.realtime

import feature.chat.ChatMessageUi
import feature.chat.ChatUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatRealtimeEventReducerTest {
    private fun openChatState(
        chatId: String = "c1",
        messages: List<ChatMessageUi> = emptyList(),
        meUserId: String? = "me",
    ): ChatUiState =
        ChatUiState(
            selectedChatId = chatId,
            selectedChatMessages = messages,
            meUserId = meUserId,
        )

    @Test
    fun reduceMessageRead_updatesPartnerReadCursorForOpenChat() {
        val before = openChatState(chatId = "c1")
        val after =
            ChatRealtimeEventReducer.reduceMessageRead(
                chatState = before,
                chatId = "c1",
                upToMessageId = "m9",
                listRefreshDelayMs = 900L,
            )
        assertEquals("m9", after.chatState.selectedChatPartnerLastReadMessageId)
        assertEquals(1, after.effects.size)
    }

    @Test
    fun reduceMessageRead_leavesStateWhenDifferentChatOpen() {
        val before = openChatState(chatId = "other")
        val after =
            ChatRealtimeEventReducer.reduceMessageRead(
                chatState = before,
                chatId = "c1",
                upToMessageId = "m9",
                listRefreshDelayMs = 900L,
            )
        assertEquals(before, after.chatState)
    }

    @Test
    fun reduceMessageEdited_patchesOpenThread() {
        val before =
            openChatState(
                messages =
                    listOf(
                        ChatMessageUi(id = "m1", senderId = "u2", body = "old", createdAt = "t1"),
                    ),
            )
        val after =
            ChatRealtimeEventReducer.reduceMessageEdited(
                chatState = before,
                chatId = "c1",
                messageId = "m1",
                editedBody = "new",
                editedAt = "t2",
                backgroundCachedMessages = null,
                followupRefreshDelayMs = 400L,
            )
        assertEquals("new", after.chatState.selectedChatMessages.single().body)
        assertEquals("t2", after.chatState.selectedChatMessages.single().editedAt)
        assertEquals("c1", after.cacheUpdate?.chatId)
    }

    @Test
    fun reduceMessageDeleted_marksMessageDeletedInOpenThread() {
        val before =
            openChatState(
                messages =
                    listOf(
                        ChatMessageUi(
                            id = "m1",
                            senderId = "u2",
                            body = "secret",
                            createdAt = "t1",
                            attachmentContentId = "att-1",
                        ),
                    ),
            )
        val after =
            ChatRealtimeEventReducer.reduceMessageDeleted(
                chatState = before,
                chatId = "c1",
                messageId = "m1",
                backgroundCachedMessages = null,
                followupRefreshDelayMs = 400L,
            )
        val msg = after.chatState.selectedChatMessages.single()
        assertTrue(msg.isDeleted)
        assertEquals("", msg.body)
        assertNull(msg.attachmentContentId)
    }

    @Test
    fun reduceMessageNew_skipsDuplicateId() {
        val before =
            openChatState(
                messages =
                    listOf(
                        ChatMessageUi(id = "m1", senderId = "u2", body = "hi", createdAt = "t1"),
                    ),
            )
        val incoming = ChatMessageUi(id = "m1", senderId = "u2", body = "hi", createdAt = "t1")
        val after =
            ChatRealtimeEventReducer.reduceMessageNewFromParsed(
                chatState = before,
                chatId = "c1",
                parsed =
                    feature.chat.GafChatMessageNewPayload(
                        chatId = "c1",
                        messageId = "m1",
                        body = "hi",
                        senderId = "u2",
                        createdAt = "t1",
                        attachmentContentId = null,
                        attachmentName = null,
                        attachmentMimeType = null,
                        attachmentSize = null,
                        replyToMessageId = null,
                        usedSyntheticMessageId = false,
                        metadataJson = null,
                    ),
                incoming = incoming,
                effectiveMe = "me",
                isMine = false,
                appInForeground = true,
                suppressNotification = true,
                listRefreshDelayMs = 900L,
                quickRefreshDelayMs = 300L,
            )
        assertTrue(after.skipped)
        assertEquals(before, after.chatState)
    }

    @Test
    fun reduceMessageNew_appendsInboundForOpenChat() {
        val before =
            openChatState(
                messages =
                    listOf(
                        ChatMessageUi(id = "m1", senderId = "u2", body = "a", createdAt = "t1"),
                    ),
            )
        val incoming = ChatMessageUi(id = "m2", senderId = "u2", body = "b", createdAt = "t2")
        val after =
            ChatRealtimeEventReducer.reduceMessageNewFromParsed(
                chatState = before,
                chatId = "c1",
                parsed =
                    feature.chat.GafChatMessageNewPayload(
                        chatId = "c1",
                        messageId = "m2",
                        body = "b",
                        senderId = "u2",
                        createdAt = "t2",
                        attachmentContentId = null,
                        attachmentName = null,
                        attachmentMimeType = null,
                        attachmentSize = null,
                        replyToMessageId = null,
                        usedSyntheticMessageId = false,
                        metadataJson = null,
                    ),
                incoming = incoming,
                effectiveMe = "me",
                isMine = false,
                appInForeground = true,
                suppressNotification = true,
                listRefreshDelayMs = 900L,
                quickRefreshDelayMs = 300L,
            )
        assertFalse(after.skipped)
        assertEquals(listOf("m1", "m2"), after.chatState.selectedChatMessages.map { it.id })
    }

    @Test
    fun reduceMessageNew_schedulesListRefreshWhenOtherChatOpen() {
        val before = openChatState(chatId = "other", messages = emptyList())
        val incoming = ChatMessageUi(id = "m2", senderId = "u2", body = "b", createdAt = "t2")
        val after =
            ChatRealtimeEventReducer.reduceMessageNewFromParsed(
                chatState = before,
                chatId = "c1",
                parsed =
                    feature.chat.GafChatMessageNewPayload(
                        chatId = "c1",
                        messageId = "m2",
                        body = "b",
                        senderId = "u2",
                        createdAt = "t2",
                        attachmentContentId = null,
                        attachmentName = null,
                        attachmentMimeType = null,
                        attachmentSize = null,
                        replyToMessageId = null,
                        usedSyntheticMessageId = false,
                        metadataJson = null,
                    ),
                incoming = incoming,
                effectiveMe = "me",
                isMine = false,
                appInForeground = true,
                suppressNotification = true,
                listRefreshDelayMs = 900L,
                quickRefreshDelayMs = 300L,
            )
        assertEquals(before, after.chatState)
        assertTrue(after.effects.any { it is ChatRealtimeEffect.ScheduleChatListRefresh })
    }

    @Test
    fun reduceMessageNew_emitsNotificationEffectWhenBackgroundChat() {
        val before = openChatState(chatId = "other")
        val incoming = ChatMessageUi(id = "m2", senderId = "u2", body = "ping", createdAt = "t2")
        val mergeResult =
            feature.chat.mergeGafChatMessageNew(before.selectedChatMessages, incoming, isMine = false)
        val after =
            ChatRealtimeEventReducer.reduceMessageNew(
                chatState = before,
                chatId = "c1",
                incoming = incoming,
                effectiveMe = "me",
                isMine = false,
                appInForeground = false,
                suppressNotification = false,
                mergeResult = mergeResult,
                listRefreshDelayMs = 900L,
            )
        assertTrue(
            after.effects.any {
                it is ChatRealtimeEffect.ShowNewMessageNotification && it.chatId == "c1"
            },
        )
    }

    @Test
    fun reduceE2eeConsentChanged_updatesOpenThreadConsent() {
        val before = openChatState(chatId = "c1")
        val after =
            ChatRealtimeEventReducer.reduceE2eeConsentChanged(
                chatState = before,
                chatId = "c1",
                status = "active",
                ready = true,
                requestedByUserId = "u9",
                quickRefreshDelayMs = 300L,
            )
        assertEquals("active", after.chatState.e2eeConsent.status)
        assertTrue(after.chatState.e2eeConsent.ready)
        assertEquals("u9", after.chatState.e2eeConsent.requestedByUserId)
        assertTrue(
            after.effects.any {
                it is ChatRealtimeEffect.RememberE2eeStatusFromSocket && it.status == "active"
            },
        )
    }
}
