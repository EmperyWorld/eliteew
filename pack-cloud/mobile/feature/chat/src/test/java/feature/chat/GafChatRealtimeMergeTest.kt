/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Socket reconnect dedup tests for optimistic pending merge and duplicate id skip.
 *
 * Invariants:
 * - Duplicate server ids never create a second row after reconnect.
 *
 * Related:
 * - ChatModels.kt mergeGafChatMessageNew, MainViewModel.onMessageNew
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GafChatRealtimeMergeTest {
    @Test
    fun mergeGafChatMessageNew_skipsDuplicateServerId() {
        val existing =
            listOf(
                ChatMessageUi(id = "m1", senderId = "u2", body = "hi", createdAt = "2026-06-02T10:00:00Z"),
            )
        val incoming = ChatMessageUi(id = "m1", senderId = "u2", body = "hi", createdAt = "2026-06-02T10:00:00Z")
        val result = mergeGafChatMessageNew(existing, incoming, isMine = false)
        assertTrue(result.skippedDuplicate)
        assertEquals(1, result.messages.size)
    }

    @Test
    fun mergeGafChatMessageNew_replacesOptimisticPendingForMine() {
        val existing =
            listOf(
                ChatMessageUi(
                    id = "pending-1",
                    senderId = "me",
                    body = "out",
                    createdAt = null,
                    isPending = true,
                ),
            )
        val incoming =
            ChatMessageUi(
                id = "server-99",
                senderId = "me",
                body = "out",
                createdAt = "2026-06-02T10:01:00Z",
                isPending = false,
            )
        val result = mergeGafChatMessageNew(existing, incoming, isMine = true)
        assertEquals("pending-1", result.removedPendingId)
        assertEquals(listOf("server-99"), result.messages.map { it.id })
    }

    @Test
    fun mergeGafChatMessageNew_appendsInboundMessage() {
        val existing =
            listOf(
                ChatMessageUi(id = "m1", senderId = "u2", body = "a", createdAt = "2026-06-02T10:00:00Z"),
            )
        val incoming =
            ChatMessageUi(id = "m2", senderId = "u2", body = "b", createdAt = "2026-06-02T10:01:00Z")
        val result = mergeGafChatMessageNew(existing, incoming, isMine = false)
        assertNull(result.removedPendingId)
        assertEquals(listOf("m1", "m2"), result.messages.map { it.id })
    }
}
