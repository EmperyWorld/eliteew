/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MA-01 regression: UgsImagesScreen history thumbnails must not hardcode prod app host.
 *
 * Invariants:
 * - Coil image URLs for unified content use dynamic api base (UnifiedContentUrls / media holder).
 *
 * Related:
 * - UgsImagesScreen.kt, UnifiedContentUrls.kt, MASTER_RE_MEDIATION_BACKLOG.md MA-01
 */
package feature.ugs

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class UgsImagesScreenUrlContractTest {
    @Test
    fun ugsImagesScreen_mustNotHardcodeProdAppContentDownloadHost() {
        val src = ugsImagesScreenSource()
        assertFalse(
            "UgsImagesScreen must not hardcode https://app.eliteew.ru/api/v1/content/…/download; " +
                "use EmperyMediaPlayerHolder.contentDownloadUrl or UnifiedContentUrls.downloadUrl",
            src.contains("https://app.eliteew.ru/api/v1/content/"),
        )
    }

    @Test
    fun ugsImagesScreen_resolvesHistoryImageViaDynamicContentUrlHelper() {
        val src = ugsImagesScreenSource()
        assertTrue(
            src.contains("EmperyMediaPlayerHolder.contentDownloadUrl") ||
                src.contains("UnifiedContentUrls.downloadUrl"),
        )
    }

    private fun ugsImagesScreenSource(): String {
        val path = File("src/main/java/feature/ugs/UgsImagesScreen.kt")
        require(path.isFile) { "Expected UgsImagesScreen.kt at ${path.absolutePath}" }
        return path.readText()
    }
}
