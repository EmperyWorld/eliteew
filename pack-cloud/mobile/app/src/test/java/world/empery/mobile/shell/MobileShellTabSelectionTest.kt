package world.empery.mobile.shell

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileShellTabSelectionTest {
    @Test
    fun notificationsTabSelectedOnOwnRoute() {
        assertTrue(isShellTabSelected("notifications", RootTab.Notifications))
        assertFalse(isShellTabSelected("notifications", RootTab.Feed))
        assertFalse(isShellTabSelected("notifications", RootTab.Chat))
    }

    @Test
    fun ewHubRootSelectedOnlyOnUgsHubRoute() {
        assertTrue(isEwHubRouteSelected("ugs"))
        assertFalse(isEwHubRouteSelected("ugs/songs"))
        assertFalse(isEwHubRouteSelected("ugs/content"))
        assertFalse(isEwHubRouteSelected("feed"))
        assertFalse(isEwHubRouteSelected("chat"))
    }

    @Test
    fun ewHubNavHighlightedOnNestedUgsRoutes() {
        assertTrue(isEwHubNavHighlighted("ugs"))
        assertTrue(isEwHubNavHighlighted("ugs/songs"))
        assertTrue(isEwHubNavHighlighted("ugs/content"))
        assertFalse(isEwHubNavHighlighted("feed"))
    }

    @Test
    fun railLabelsOnlyOnExpandedRailAndCompactScale() {
        assertFalse(shouldShowShellRailLabels(useExpandedNavigationRail = false, showsBottomNavLabels = true))
        assertTrue(shouldShowShellRailLabels(useExpandedNavigationRail = true, showsBottomNavLabels = true))
        assertFalse(shouldShowShellRailLabels(useExpandedNavigationRail = true, showsBottomNavLabels = false))
    }

    @Test
    fun tabSelectedOnOwnRoute() {
        assertTrue(isShellTabSelected("chat", RootTab.Chat))
        assertFalse(isShellTabSelected("feed", RootTab.Chat))
    }
}
