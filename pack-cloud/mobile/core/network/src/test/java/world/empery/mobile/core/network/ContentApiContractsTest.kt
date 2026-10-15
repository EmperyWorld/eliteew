package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.network.api.UnifiedContentListResponse
import world.empery.mobile.core.network.api.allowsStoredThumbnailFetch
import world.empery.mobile.core.network.api.storedThumbnailAbsoluteUrl

class ContentApiContractsTest {
    private val gson = Gson()

    @Test
    fun contentRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(UnifiedContentApi::class, "uploadContent", "content")
        ApiContractPathAssertions.assertGet(UnifiedContentApi::class, "listContent", "content")
        ApiContractPathAssertions.assertGet(
            UnifiedContentApi::class,
            "downloadContent",
            "content/{id}/download",
        )
    }

    @Test
    fun parsesPaginatedContentList() {
        val json = """
            {
              "items": [{"id": "c-1", "name": "photo.jpg", "mime_type": "image/jpeg", "created_at": null, "file_size": 1024}],
              "total": 1,
              "page": 1,
              "page_size": 50,
              "has_more": false
            }
        """.trimIndent()
        val page = gson.fromJson(json, UnifiedContentListResponse::class.java)
        assertEquals(1, page.items.size)
        assertEquals(false, page.has_more)
    }

    @Test
    fun allowsStoredThumbnailFetch_onlyWhenUrlSet_skipBroken() {
        val withUrl =
            UnifiedContentDto(
                id = "1",
                name = "a",
                mime_type = "image/png",
                created_at = null,
                file_size = 1L,
                thumbnail_url = "/api/v1/content/1/thumbnail",
            )
        val noUrl =
            UnifiedContentDto(
                id = "2",
                name = "b",
                mime_type = "audio/mpeg",
                created_at = null,
                file_size = 1L,
                thumbnail_url = null,
            )
        val broken =
            withUrl.copy(storage_integrity_status = "broken_quarantined")
        assertTrue(withUrl.allowsStoredThumbnailFetch())
        assertFalse(noUrl.allowsStoredThumbnailFetch())
        assertFalse(broken.allowsStoredThumbnailFetch())
        assertEquals(
            "https://api.example/content/1/thumbnail",
            withUrl.storedThumbnailAbsoluteUrl("https://api.example/"),
        )
        assertNull(noUrl.storedThumbnailAbsoluteUrl("https://api.example/"))
        assertNull(broken.storedThumbnailAbsoluteUrl("https://api.example/"))
    }
}
