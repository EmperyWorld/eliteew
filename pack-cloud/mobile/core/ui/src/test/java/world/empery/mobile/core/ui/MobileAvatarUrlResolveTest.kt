/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for shared mobile avatar URL resolution used by Friends/Profile Coil loads.
 *
 * Related:
 * - MobileAvatarPlaceholder.kt, EwDeskLinkedMediaUrls
 */
package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileAvatarUrlResolveTest {
    @Test
    fun relativeApiPath_isPrefixedWithWebOrigin() {
        assertEquals(
            "https://app.eliteew.ru/api/v1/users/avatar/1",
            resolveMobileAvatarUrl(
                apiBaseUrl = "https://app.eliteew.ru/api/v1/",
                rawUrl = "/api/v1/users/avatar/1",
            ),
        )
    }

    @Test
    fun absoluteHttps_passesThrough() {
        val url = "https://cdn.example/a.png"
        assertEquals(
            url,
            resolveMobileAvatarUrl(apiBaseUrl = "https://app.eliteew.ru/api/v1/", rawUrl = url),
        )
    }

    @Test
    fun blankOrRelativeWithoutApiBase_returnsNull() {
        assertNull(resolveMobileAvatarUrl(apiBaseUrl = "", rawUrl = "/media/a.png"))
        assertNull(resolveMobileAvatarUrl(apiBaseUrl = "https://app.eliteew.ru/api/v1/", rawUrl = "  "))
        assertNull(resolveMobileAvatarUrl(apiBaseUrl = "https://app.eliteew.ru/api/v1/", rawUrl = null))
    }
}
