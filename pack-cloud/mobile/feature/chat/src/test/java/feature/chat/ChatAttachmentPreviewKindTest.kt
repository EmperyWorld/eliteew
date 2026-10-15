/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for attachment preview classification and safe-content warnings.
 *
 * Related:
 * - ChatModels.kt, ChatFeature.kt attachment rows
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatAttachmentPreviewKindTest {
    private val sampleContentId = "b8114d48-56fa-4ea1-9f7f-0531ea896180"

    @Test
    fun classifyAttachmentPreviewKind_detectsPdfAndAudio() {
        assertEquals(
            ChatAttachmentPreviewKind.Pdf,
            classifyChatAttachmentPreviewKind("application/pdf", "doc.pdf", sampleContentId),
        )
        assertEquals(
            ChatAttachmentPreviewKind.Audio,
            classifyChatAttachmentPreviewKind("audio/mpeg", "voice.mp3", sampleContentId),
        )
    }

    @Test
    fun shouldShowSafeContentWarning_onlyForRiskyInstallers() {
        assertFalse(shouldShowSafeContentWarning("application/octet-stream", "file.bin"))
        assertFalse(shouldShowSafeContentWarning(null, "photo.jpg"))
        assertFalse(shouldShowSafeContentWarning("image/png", "x.png"))
        assertTrue(shouldShowSafeContentWarning(null, "update.apk"))
    }
}
