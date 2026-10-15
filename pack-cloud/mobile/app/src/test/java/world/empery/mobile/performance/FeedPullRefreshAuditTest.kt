package world.empery.mobile.performance

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * W4 U1 / DEBT-X-01 lock: EWDesk Feed tab must expose shell pull-to-refresh
 * via RefreshableRoute → feedVm::refresh (same path as FeedFeature onRefresh).
 */
class FeedPullRefreshAuditTest {
    @Test
    fun feedTabUsesRefreshableRouteWithFeedVmRefresh() {
        val main = locateRepoFile("app/src/main/java/world/empery/mobile/MainActivity.kt")
        assertTrue("MainActivity.kt should exist", main.isFile)
        val src = main.readText()
        val feedComposableIdx = src.indexOf("composable(RootTab.Feed.route)")
        assertTrue("Feed tab composable should exist", feedComposableIdx >= 0)
        val feedSlice = src.substring(feedComposableIdx, (feedComposableIdx + 2500).coerceAtMost(src.length))
        assertTrue(
            "Feed tab must wrap content in RefreshableRoute",
            feedSlice.contains("RefreshableRoute("),
        )
        assertTrue(
            "Feed RefreshableRoute must bind feedVm::refresh",
            feedSlice.contains("onRefresh = feedVm::refresh"),
        )
        assertTrue(
            "Feed RefreshableRoute must bind feed loading state",
            feedSlice.contains("isRefreshing = feedState.isLoading"),
        )
        assertTrue(
            "EwDeskFeedScreen must keep onRefresh = feedVm::refresh (same path)",
            feedSlice.contains("EwDeskFeedScreen(") && feedSlice.contains("onRefresh = feedVm::refresh"),
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
