package world.empery.mobile.shell

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.ShellNavigationIntent

class SessionNavigationBridgeTest {
    @Test
    fun request_preservesFriendsActionCenterNestedRoute() = runBlocking {
        val bridge = SessionNavigationBridge(this)

        bridge.request(
            ShellNavigationIntent(
                tabRoute = "friends",
                nestedRoute = "friends/action-center",
                friendsFocus = "action_center",
            ),
        )

        val emitted = withTimeout(1_000) { bridge.routes.first() }
        assertEquals("friends", emitted.tabRoute)
        assertEquals("friends/action-center", emitted.nestedRoute)
        assertEquals("action_center", emitted.friendsFocus)
    }

    @Test
    fun request_preservesDesktopNestedRoute() = runBlocking {
        val bridge = SessionNavigationBridge(this)
        val intent = MobileDeepLinks.shellNavigationIntentForIncomingTab("desktop")
        requireNotNull(intent)

        bridge.request(intent)

        val emitted = withTimeout(1_000) { bridge.routes.first() }
        assertEquals("ugs", emitted.tabRoute)
        assertEquals("ugs/desktop", emitted.nestedRoute)
    }

    @Test
    fun request_keepsFeedPostOnlyForFeedRoute() = runBlocking {
        val bridge = SessionNavigationBridge(this)
        val postId = "123e4567-e89b-12d3-a456-426614174000"

        bridge.request(ShellNavigationIntent(tabRoute = "feed", ewDeskPostId = postId))

        val emitted = withTimeout(1_000) { bridge.routes.first() }
        assertEquals("feed", emitted.tabRoute)
        assertEquals(postId, emitted.ewDeskPostId)
        assertNull(emitted.nestedRoute)
    }

    @Test
    fun request_preservesProfileSection() = runBlocking {
        val bridge = SessionNavigationBridge(this)

        bridge.request(ShellNavigationIntent(tabRoute = "profile", profileSection = "updates"))

        val emitted = withTimeout(1_000) { bridge.routes.first() }
        assertEquals("profile", emitted.tabRoute)
        assertEquals("updates", emitted.profileSection)
    }

    @Test
    fun request_preservesDesktopHubSection() = runBlocking {
        val bridge = SessionNavigationBridge(this)

        bridge.request(
            ShellNavigationIntent(
                tabRoute = "ugs",
                nestedRoute = "ugs/desktop",
                desktopHubSection = "notes",
            ),
        )

        val emitted = withTimeout(1_000) { bridge.routes.first() }
        assertEquals("ugs", emitted.tabRoute)
        assertEquals("ugs/desktop", emitted.nestedRoute)
        assertEquals("notes", emitted.desktopHubSection)
    }
}
