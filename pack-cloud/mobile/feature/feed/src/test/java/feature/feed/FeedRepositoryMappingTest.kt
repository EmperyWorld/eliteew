package feature.feed

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.EwDeskNewsListItemDto

class FeedRepositoryMappingTest {
    @Test
    fun listItemUsesBodyExcerptAsFeedBody() {
        val entity =
            ewDeskListItemToFeedEntity(
                EwDeskNewsListItemDto(
                    id = "11111111-1111-1111-1111-111111111111",
                    title = "News",
                    body_excerpt = "Short",
                    created_at = "2026-05-27T09:00:00+00:00",
                    updated_at = "2026-05-27T10:00:00+00:00",
                ),
            )
        assertEquals("Short", entity.body)
        assertEquals("News", entity.title)
    }
}
