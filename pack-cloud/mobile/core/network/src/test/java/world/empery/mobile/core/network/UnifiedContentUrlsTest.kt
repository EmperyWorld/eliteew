/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for authenticated unified content media URLs (MA-01 / Wave 2).
 *
 * Invariants:
 * - Download/thumbnail URLs must derive from configured api base, not a fixed prod host.
 *
 * Related:
 * - UnifiedContentUrls.kt, UgsImagesScreen.kt, EmperyMediaPlayerHolder.kt
 */
package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class UnifiedContentUrlsTest {
    private val contentId = "970e23a2-b9aa-42ff-9dee-acccf0c0b8ba"

    @Test
    fun downloadUrl_usesConfiguredStagingApiBase() {
        val base = "https://app-staging.eliteew.ru/api/v1/"
        val url = UnifiedContentUrls.downloadUrl(base, contentId)
        assertEquals(
            "https://app-staging.eliteew.ru/api/v1/content/$contentId/download",
            url,
        )
        assertFalse(url.contains("https://app.eliteew.ru/"))
    }

    @Test
    fun downloadUrl_usesConfiguredDevApiBase() {
        val base = "https://192.168.1.136:29000/api/v1/"
        val url = UnifiedContentUrls.downloadUrl(base, contentId)
        assertEquals(
            "https://192.168.1.136:29000/api/v1/content/$contentId/download",
            url,
        )
    }

    @Test
    fun thumbnailUrl_usesConfiguredApiBase() {
        val base = "https://app-staging.eliteew.ru/api/v1/"
        val url = UnifiedContentUrls.thumbnailUrl(base, contentId)
        assertEquals(
            "https://app-staging.eliteew.ru/api/v1/content/$contentId/thumbnail",
            url,
        )
    }
}
