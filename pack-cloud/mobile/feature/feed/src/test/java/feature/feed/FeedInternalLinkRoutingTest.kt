/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
package feature.feed

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeedInternalLinkRoutingTest {
    @Test
    fun parsesDesktopOpenAppLink() {
        val link = parseFeedInternalAppLink("/__eliteew-desktop-open-app__/ugs?nested=desktop")
        requireNotNull(link)
        assertEquals("ugs", link.appId)
        assertEquals("desktop", link.query["nested"])
    }

    @Test
    fun ignoresExternalUrls() {
        assertNull(parseFeedInternalAppLink("https://empery.world"))
    }

    @Test
    fun mapsLegacyDesktopTabToUgsNestedRoute() {
        val link = parseFeedInternalAppLink("/__eliteew-desktop-open-app__/desktop")
        val (tab, nested) = requireNotNull(link).toMobileRoute()
        assertEquals("ugs", tab)
        assertEquals("ugs/desktop", nested)
    }

    @Test
    fun mapsGafChatDesktopOpenLinkToStoreAppId() {
        val link = parseFeedInternalAppLink("/__eliteew-desktop-open-app__/GAFChatApp")
        assertEquals("GAFChatApp", requireNotNull(link).toStoreAppIdForMobileShell())
    }

    @Test
    fun mapsNestedShellSettingsPathToRootComponentId() {
        val link = parseFeedInternalAppLink("/__eliteew-desktop-open-app__/EliteEwShellSettings/performance")
        assertEquals("EliteEwShellSettings", requireNotNull(link).appId)
        assertEquals("EliteEwShellSettings", link.toStoreAppIdForMobileShell())
    }

    @Test
    fun resolveFeedOpenAppStoreIdReturnsNullForExternalUrl() {
        assertEquals(null, resolveFeedOpenAppStoreId("https://empery.world"))
    }
}
