package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileMediaUrlSupportTest {
    @Test
    fun resolveApiMediaUrl_prefixesRelativeApiPath() {
        val base = "https://app.empery.world/api/v1/"
        assertEquals(
            "https://app.empery.world/api/v1/users/avatar/1",
            EwDeskLinkedMediaUrls.resolveApiMediaUrl(base, "/api/v1/users/avatar/1"),
        )
    }

    @Test
    fun resolveApiMediaUrl_keepsAbsoluteHttps() {
        val url = "https://cdn.example/avatar.png"
        assertEquals(url, EwDeskLinkedMediaUrls.resolveApiMediaUrl("https://app.empery.world/api/v1/", url))
    }

    @Test
    fun mobileWebOrigin_stripsApiSuffix() {
        assertEquals(
            "https://app.empery.world",
            MobileWebOrigin.fromApiBase("https://app.empery.world/api/v1/"),
        )
    }
}
