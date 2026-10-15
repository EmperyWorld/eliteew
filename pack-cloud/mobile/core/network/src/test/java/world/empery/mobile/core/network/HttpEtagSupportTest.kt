package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import retrofit2.Response

class HttpEtagSupportTest {
    @Test
    fun parseEtag_readsHeader() {
        val raw =
            okhttp3.Response.Builder()
                .code(200)
                .message("OK")
                .protocol(okhttp3.Protocol.HTTP_1_1)
                .request(okhttp3.Request.Builder().url("https://example.test/friends/overview").build())
                .header("ETag", "\"abc123\"")
                .build()
        val response = Response.success("ok", raw)
        assertEquals("\"abc123\"", HttpEtagSupport.parseEtag(response))
    }

    @Test
    fun parseEtag_blankHeaderReturnsNull() {
        assertNull(HttpEtagSupport.parseEtag(Response.success("ok")))
    }
}
