/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for attachment disk meta normalization when Gson yields null fields.
 *
 * Related:
 * - ChatRepository.kt readCachedDownload, MainViewModel.openChat
 */
package feature.chat

import org.junit.Assert.assertEquals
import org.junit.Test

class ChatAttachmentDiskMetaTest {
    @Test
    fun normalizeAttachmentDiskMeta_nullFields_useDefaults() {
        val (mime, name) = normalizeAttachmentDiskMeta(null, null)
        assertEquals("application/octet-stream", mime)
        assertEquals("attachment", name)
    }

    @Test
    fun normalizeAttachmentDiskMeta_blankFields_useDefaults() {
        val (mime, name) = normalizeAttachmentDiskMeta("  ", "")
        assertEquals("application/octet-stream", mime)
        assertEquals("attachment", name)
    }

    @Test
    fun normalizeAttachmentDiskMeta_preservesValues() {
        val (mime, name) = normalizeAttachmentDiskMeta("image/png", "photo.png")
        assertEquals("image/png", mime)
        assertEquals("photo.png", name)
    }
}
