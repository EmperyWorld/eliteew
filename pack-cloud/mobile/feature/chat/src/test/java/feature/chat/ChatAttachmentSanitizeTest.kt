/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for GAF chat attachment field sanitization (null sentinels, UUID gate).
 *
 * Invariants:
 * - Text-only rows must not carry renderable attachment metadata.
 *
 * Related:
 * - ChatModels.kt, RealtimeChatBridge.kt
 */
package feature.chat

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatAttachmentSanitizeTest {
    @Test
    fun sanitizeGafAttachmentContentId_rejectsNullSentinel() {
        assertNull(sanitizeGafAttachmentContentId("null"))
        assertNull(sanitizeGafAttachmentContentId(" NULL "))
    }

    @Test
    fun sanitizeGafAttachmentContentId_acceptsUuid() {
        val id = "b8114d48-56fa-4ea1-9f7f-0531ea896180"
        assertEquals(id, sanitizeGafAttachmentContentId(id))
    }

    @Test
    fun hasRenderableChatAttachment_requiresUuidAndMetadata() {
        assertFalse(
            hasRenderableChatAttachment(
                attachmentContentId = "null",
                attachmentMimeType = "image/jpeg",
                attachmentName = "photo.jpg",
            ),
        )
        assertFalse(
            hasRenderableChatAttachment(
                attachmentContentId = "b8114d48-56fa-4ea1-9f7f-0531ea896180",
                attachmentMimeType = null,
                attachmentName = null,
            ),
        )
        assertTrue(
            hasRenderableChatAttachment(
                attachmentContentId = "b8114d48-56fa-4ea1-9f7f-0531ea896180",
                attachmentMimeType = "image/jpeg",
                attachmentName = "photo.jpg",
            ),
        )
    }

    @Test
    fun parseGafChatMessageNewPayload_stripsNullAttachmentId() {
        val payload =
            JSONObject(
                """
                {
                  "chat_id": "c1",
                  "id": "m1",
                  "body": "hello",
                  "attachment_content_id": "null",
                  "attachment_name": "null"
                }
                """.trimIndent(),
            )
        val parsed = parseGafChatMessageNewPayload(payload)
        assertEquals("hello", parsed!!.body)
        assertNull(parsed.attachmentContentId)
        assertNull(parsed.attachmentName)
    }
}
