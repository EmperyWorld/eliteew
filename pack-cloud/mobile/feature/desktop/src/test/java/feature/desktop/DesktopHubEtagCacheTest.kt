package feature.desktop

import okhttp3.Headers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import retrofit2.Response

class DesktopHubEtagCacheTest {
    @Test
    fun remembersSeparateEtagsPerResource() {
        val cache = DesktopHubEtagCache()
        cache.rememberConfig(Response.success(Any(), Headers.headersOf("ETag", "\"cfg\"")))
        cache.rememberShell(Response.success(Any(), Headers.headersOf("ETag", "\"shell\"")))
        cache.rememberInstalled(Response.success(Any(), Headers.headersOf("ETag", "\"inst\"")))
        assertEquals("\"cfg\"", cache.configEtag)
        assertEquals("\"shell\"", cache.shellEtag)
        assertEquals("\"inst\"", cache.installedEtag)
    }

    @Test
    fun invalidateAllClearsConditionalGetKeys() {
        val cache = DesktopHubEtagCache()
        cache.rememberConfig(Response.success(Any(), Headers.headersOf("ETag", "\"cfg\"")))
        cache.invalidateAll()
        assertNull(cache.configEtag)
        assertNull(cache.shellEtag)
        assertNull(cache.installedEtag)
    }
}
