package world.empery.mobile.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.MobileDeepLinks

class MobileRouteRegistryTest {
    @Test
    fun bottomTabs_matchDeepLinkCanonicalRoutes() {
        assertEquals(
            setOf("feed", "chat", "ugs", "notifications", "friends", "profile"),
            MobileRouteRegistry.bottomTabRoutes,
        )
        MobileRouteRegistry.bottomTabRoutes.forEach { route ->
            assertTrue(MobileDeepLinks.isIncomingTabRoute(route) || route == "ugs")
        }
    }

    @Test
    fun resolveTabRouteForIncoming_mapsDesktopToUgs() {
        assertEquals("ugs", MobileRouteRegistry.resolveTabRouteForIncoming("desktop"))
    }

    @Test
    fun isKnownShellRoute_includesNotificationsAndUgsNested() {
        assertTrue(MobileRouteRegistry.isKnownShellRoute("notifications"))
        assertTrue(MobileRouteRegistry.isKnownShellRoute("ugs/chat"))
        assertTrue(MobileRouteRegistry.isKnownShellRoute("ugs/chat/abc-123"))
        assertTrue(MobileRouteRegistry.isKnownShellRoute("friends/action-center"))
        assertFalse(MobileRouteRegistry.isKnownShellRoute("unknown"))
    }

    @Test
    fun coerceBottomTabRoute_acceptsNotificationsTab_rejectsNestedUgs() {
        assertEquals("feed", MobileRouteRegistry.coerceBottomTabRoute("feed"))
        assertEquals("notifications", MobileRouteRegistry.coerceBottomTabRoute("notifications"))
        assertNull(MobileRouteRegistry.coerceBottomTabRoute("ugs/chat"))
        assertNull(MobileRouteRegistry.coerceBottomTabRoute(null))
    }

    @Test
    fun shellIntentForIncomingTab_preservesDesktopNested() {
        val intent = MobileRouteRegistry.shellIntentForIncomingTab("desktop")
        requireNotNull(intent)
        assertEquals("ugs", intent.tabRoute)
        assertEquals("ugs/desktop", intent.nestedRoute)
    }

    @Test
    fun telemetryRouteName_defaultsWhenBlank() {
        assertEquals(MobileRouteRegistry.defaultStartRoute, MobileRouteRegistry.telemetryRouteName(null))
        assertEquals("chat", MobileRouteRegistry.telemetryRouteName("chat"))
    }
}
