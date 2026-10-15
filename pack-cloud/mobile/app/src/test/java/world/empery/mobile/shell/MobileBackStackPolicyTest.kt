package world.empery.mobile.shell

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.ShellNavigationIntent

class MobileBackStackPolicyTest {
    @Test
    fun planShellNavigation_notificationsOpensBottomTabDirectly() {
        val plan =
            MobileBackStackPolicy.planShellNavigation(
                ShellNavigationIntent(tabRoute = "notifications"),
            )
        assertEquals(RootTab.Notifications.route, plan.bottomTabRoute)
        assertEquals(emptyList<String>(), plan.nestedRoutes)
    }

    @Test
    fun planShellNavigation_desktopOpensUgsAndNestedHub() {
        val plan =
            MobileBackStackPolicy.planShellNavigation(
                ShellNavigationIntent(tabRoute = "ugs", nestedRoute = "ugs/desktop"),
            )
        assertEquals(RootTab.Ugs.route, plan.bottomTabRoute)
        assertEquals(listOf("ugs/desktop"), plan.nestedRoutes)
    }

    @Test
    fun planShellNavigation_friendsActionCenterNested() {
        val plan =
            MobileBackStackPolicy.planShellNavigation(
                ShellNavigationIntent(
                    tabRoute = "friends",
                    nestedRoute = "friends/action-center",
                ),
            )
        assertEquals(RootTab.Friends.route, plan.bottomTabRoute)
        assertEquals(listOf("friends/action-center"), plan.nestedRoutes)
    }

    @Test
    fun shouldHideBottomBar_forFriendsActionCenter() {
        assertTrue(
            MobileBackStackPolicy.shouldHideBottomNavigationBar(
                currentRoute = "friends/action-center",
                chatThreadOpen = false,
            ),
        )
    }

    @Test
    fun shouldHideBottomBar_forUgsNestedAndChatThread() {
        assertTrue(
            MobileBackStackPolicy.shouldHideBottomNavigationBar(
                currentRoute = "ugs/chat",
                chatThreadOpen = false,
            ),
        )
        assertTrue(
            MobileBackStackPolicy.shouldHideBottomNavigationBar(
                currentRoute = RootTab.Chat.route,
                chatThreadOpen = true,
            ),
        )
        assertFalse(
            MobileBackStackPolicy.shouldHideBottomNavigationBar(
                currentRoute = RootTab.Feed.route,
                chatThreadOpen = false,
            ),
        )
    }

    @Test
    fun onBackPressed_popsNestedRoutesOnly() {
        val nested = MobileBackStackPolicy.onBackPressed("ugs/songs")
        assertTrue(nested.shouldPop)

        val notificationsTab = MobileBackStackPolicy.onBackPressed(RootTab.Notifications.route)
        assertFalse(notificationsTab.shouldPop)

        val tab = MobileBackStackPolicy.onBackPressed(RootTab.Profile.route)
        assertFalse(tab.shouldPop)
    }

    @Test
    fun shouldRestoreBottomTabState_falseForUgsHub() {
        assertFalse(MobileBackStackPolicy.shouldRestoreBottomTabState(RootTab.Ugs.route))
        assertTrue(MobileBackStackPolicy.shouldRestoreBottomTabState(RootTab.Feed.route))
        assertTrue(MobileBackStackPolicy.shouldRestoreBottomTabState(RootTab.Chat.route))
    }

    @Test
    fun onBackPressed_unknownRouteStillPops() {
        assertTrue(MobileBackStackPolicy.onBackPressed("custom/unknown").shouldPop)
    }
}
