package world.empery.mobile.performance

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** performance-004: lightweight audit — list screens should use LazyColumn item keys. */
class LazyColumnKeyAuditTest {
    @Test
    fun feedFeatureUsesLazyColumnKeys() {
        val feed = locateRepoFile("feature/feed/src/main/java/feature/feed/FeedFeature.kt")
        assertTrue("FeedFeature.kt should exist", feed.isFile)
        val src = feed.readText()
        assertTrue(
            "FeedFeature should use keyed LazyColumn items",
            src.contains("key =") || src.contains("key = {") || src.contains("itemsIndexed"),
        )
    }

    private fun locateRepoFile(relative: String): File {
        var dir: File? = File(System.getProperty("user.dir"))
        repeat(6) {
            val candidate = File(dir, relative)
            if (candidate.isFile) return candidate
            dir = dir?.parentFile
        }
        return File(relative)
    }
}
