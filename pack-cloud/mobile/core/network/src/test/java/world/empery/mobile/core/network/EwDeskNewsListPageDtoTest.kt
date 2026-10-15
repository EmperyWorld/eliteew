/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */
package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import world.empery.mobile.core.network.api.EwDeskNewsListPageDto

class EwDeskNewsListPageDtoTest {
    private val gson = Gson()

    @Test
    fun parsesPaginatedNewsListEnvelope() {
        val json = """
            {
              "items": [
                {
                  "id": "11111111-1111-1111-1111-111111111111",
                  "title": "Hello",
                  "body_excerpt": "Preview",
                  "pinned": false,
                  "published_at": "2026-05-27T10:00:00+00:00",
                  "created_at": "2026-05-27T09:00:00+00:00",
                  "updated_at": "2026-05-27T10:00:00+00:00"
                }
              ],
              "total": 1,
              "limit": 50,
              "offset": 0,
              "next_cursor": null
            }
        """.trimIndent()
        val page = gson.fromJson(json, EwDeskNewsListPageDto::class.java)
        assertEquals(1, page.items.size)
        assertEquals("Hello", page.items.first().title)
        assertEquals("Preview", page.items.first().body_excerpt)
        assertNotNull(page.total)
    }
}
