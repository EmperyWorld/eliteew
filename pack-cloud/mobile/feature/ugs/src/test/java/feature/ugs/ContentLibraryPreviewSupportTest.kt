/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock list-thumbnail policy: fetch /thumbnail only when API set thumbnail_url;
 * never for null URL, video, or broken_quarantined.
 *
 * Related:
 * - ContentLibraryPreviewSupport.kt
 */
package feature.ugs

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.UnifiedContentDto

class ContentLibraryPreviewSupportTest {
    @Test
    fun supportsListThumbnail_onlyWhenThumbnailUrlSet_skipBrokenAndNull() {
        val withThumb =
            UnifiedContentDto(
                id = "1",
                name = "a.txt",
                mime_type = "text/plain",
                created_at = null,
                file_size = 10L,
                thumbnail_url = "/api/v1/content/1/thumbnail",
            )
        val textNoUrl =
            UnifiedContentDto(
                id = "2",
                name = "note.md",
                mime_type = "text/markdown",
                created_at = null,
                file_size = 10L,
                thumbnail_url = null,
            )
        val imageNoUrl =
            UnifiedContentDto(
                id = "3",
                name = "shot.png",
                mime_type = "image/png",
                created_at = null,
                file_size = 10L,
                thumbnail_url = null,
            )
        val videoNoUrl =
            UnifiedContentDto(
                id = "4",
                name = "clip.mp4",
                mime_type = "video/mp4",
                created_at = null,
                file_size = 10L,
                thumbnail_url = null,
            )
        val brokenWithUrl =
            UnifiedContentDto(
                id = "5",
                name = "orphan.png",
                mime_type = "image/png",
                created_at = null,
                file_size = 10L,
                thumbnail_url = "/api/v1/content/5/thumbnail",
                storage_integrity_status = "broken_quarantined",
            )
        assertTrue(supportsListThumbnail(withThumb))
        assertFalse(supportsListThumbnail(textNoUrl))
        assertFalse(supportsListThumbnail(imageNoUrl))
        assertFalse(supportsListThumbnail(videoNoUrl))
        assertFalse(supportsListThumbnail(brokenWithUrl))
        assertNotNull(contentListThumbnailUrl(withThumb))
        assertNull(contentListThumbnailUrl(textNoUrl))
        assertNull(contentListThumbnailUrl(imageNoUrl))
        assertNull(contentListThumbnailUrl(videoNoUrl))
        assertNull(contentListThumbnailUrl(brokenWithUrl))
    }
}
