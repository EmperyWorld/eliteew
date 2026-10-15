/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
package feature.feed

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.EwDeskNewsListItemDto
import world.empery.mobile.core.storage.FeedPostEntity

class FeedCursorPaginationTest {
    @Test
    fun mergeCursorPagesAvoidsDuplicates() {
        val existing =
            listOf(
                FeedPostEntity(id = "1", title = "A", body = "a", pinned = false, publishedAt = null, updatedAt = null, imageUrl = null, imageContentId = null, videoContentId = null, audioContentId = null),
            )
        val page =
            listOf(
                EwDeskNewsListItemDto(id = "1", title = "A2", body_excerpt = "a2", created_at = "2026-01-01T00:00:00Z", updated_at = "2026-01-01T00:00:00Z"),
                EwDeskNewsListItemDto(id = "2", title = "B", body_excerpt = "b", created_at = "2026-01-01T00:00:00Z", updated_at = "2026-01-01T00:00:00Z"),
            )
        val merged = mergeFeedCursorPages(existing, page)
        assertEquals(2, merged.size)
        assertEquals("A2", merged.first { it.id == "1" }.title)
    }

    @Test
    fun cursorHasMoreWhenNextCursorPresent() {
        assertTrue(feedCursorHasMore("cursor-abc"))
        assertFalse(feedCursorHasMore(null))
        assertFalse(feedCursorHasMore("  "))
    }
}
