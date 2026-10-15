/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for GAF chat Socket.IO event names and message_new payload parsing.
 *
 * Invariants:
 * - Event constants stay stable for mobile ↔ API parity.
 *
 * Related:
 * - RealtimeChatBridge.kt, documentation/product/mobile/MOBILE-GAF-VIDEO-CALLS-WEBVIEW.md
 */
package feature.chat

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GafChatSocketEventContractTest {
    @Test
    fun gafChatSocketEvents_useStableNames() {
        assertEquals("gaf_chat.message_new", GafChatSocketEvents.MESSAGE_NEW)
        assertEquals("gaf_chat.message_read", GafChatSocketEvents.MESSAGE_READ)
        assertEquals("gaf_chat.e2ee_consent_changed", GafChatSocketEvents.E2EE_CONSENT_CHANGED)
        assertEquals("video_call.incoming", GafChatSocketEvents.VIDEO_CALL_INCOMING)
        assertEquals("video_call.accepted", GafChatSocketEvents.VIDEO_CALL_ACCEPTED)
        assertEquals("video_call.ended", GafChatSocketEvents.VIDEO_CALL_ENDED)
    }

    @Test
    fun parseGafChatMessageNewPayload_acceptsSnakeCaseFields() {
        val payload =
            JSONObject(
                """
                {
                  "chat_id": "c1",
                  "id": "m1",
                  "body": "hello",
                  "sender_id": "u1",
                  "created_at": "2026-06-02T10:00:00Z"
                }
                """.trimIndent(),
            )
        val parsed = parseGafChatMessageNewPayload(payload)
        assertNotNull(parsed)
        assertEquals("c1", parsed!!.chatId)
        assertEquals("m1", parsed.messageId)
        assertEquals("hello", parsed.body)
        assertFalse(parsed.usedSyntheticMessageId)
    }

    @Test
    fun parseGafChatMessageNewPayload_acceptsAttachmentOnlyMessage() {
        val contentId = "b8114d48-56fa-4ea1-9f7f-0531ea896180"
        val payload =
            JSONObject(
                """
                {
                  "chatId": "c2",
                  "messageId": "m2",
                  "attachment_content_id": "$contentId",
                  "attachment_name": "photo.jpg",
                  "attachment_mime_type": "image/jpeg"
                }
                """.trimIndent(),
            )
        val parsed = parseGafChatMessageNewPayload(payload)
        assertNotNull(parsed)
        assertEquals(contentId, parsed!!.attachmentContentId)
    }

    @Test
    fun parseGafChatMessageNewPayload_returnsNullWithoutVisibleContent() {
        val payload = JSONObject("""{"chat_id":"c1","id":"m1"}""")
        assertNull(parseGafChatMessageNewPayload(payload))
    }

    @Test
    fun parseGafChatMessageNewPayload_syntheticIdWhenMissing() {
        val payload = JSONObject("""{"chat_id":"c1","body":"ping"}""")
        val parsed = parseGafChatMessageNewPayload(payload)
        assertNotNull(parsed)
        assertTrue(parsed!!.usedSyntheticMessageId)
        assertTrue(parsed.messageId.startsWith("socket-"))
    }
}
