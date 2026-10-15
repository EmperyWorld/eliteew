package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileInstalledAppRoutesTest {
    @Test
    fun bottomTabRouteForStoreAppId_mapsKnownIds() {
        assertEquals("chat", MobileInstalledAppRoutes.bottomTabRouteForStoreAppId("GAFChatApp"))
        assertEquals("feed", MobileInstalledAppRoutes.bottomTabRouteForStoreAppId("EwDeskApp"))
        assertEquals("ugs", MobileInstalledAppRoutes.bottomTabRouteForStoreAppId("UnknownApp"))
    }
}
