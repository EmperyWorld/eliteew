package world.empery.mobile

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import feature.desktop.EwaCompanionWebViewLauncher

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MobileDeepLinksTest {
    @Test
    fun normalizeFriendsFocus_actionCenterAlias() {
        assertEquals("action_center", MobileDeepLinks.normalizeFriendsFocus("action_center"))
        assertEquals("action_center", MobileDeepLinks.normalizeFriendsFocus("action-center"))
    }

    @Test
    fun consumeNavUri_friendsActionCenterPath() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/friends/action-center")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("friends", captured!!.tabRoute)
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, captured!!.nestedRoute)
        assertEquals("action_center", captured!!.friendsFocus)
    }

    @Test
    fun consumeNavUri_friendsActionCenterQueryNested() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/friends?nested=action-center")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, captured!!.nestedRoute)
    }

    @Test
    fun navRouteForIncomingTab_mapsDesktopToUgs() {
        assertEquals("ugs", MobileDeepLinks.navRouteForIncomingTab("desktop"))
        assertEquals("ugs", MobileDeepLinks.navRouteForIncomingTab("DESKTOP"))
    }

    @Test
    fun navRouteForIncomingTab_keepsCanonicalRoutes() {
        assertEquals("feed", MobileDeepLinks.navRouteForIncomingTab("feed"))
        assertEquals("chat", MobileDeepLinks.navRouteForIncomingTab("chat"))
        assertEquals("ugs", MobileDeepLinks.navRouteForIncomingTab("ugs"))
    }

    @Test
    fun navRouteForIncomingTab_keepsNotificationsRoute() {
        assertEquals("notifications", MobileDeepLinks.navRouteForIncomingTab("notifications"))
    }

    @Test
    fun navRouteForIncomingTab_mapsInboxToFriends() {
        assertEquals("friends", MobileDeepLinks.navRouteForIncomingTab("inbox"))
        val intent = MobileDeepLinks.shellNavigationIntentForIncomingTab("inbox")
        requireNotNull(intent)
        assertEquals("friends", intent.tabRoute)
        assertEquals("incoming", intent.friendsFocus)
    }

    @Test
    fun normalizeFriendsFocus_incomingAliases() {
        assertEquals("incoming", MobileDeepLinks.normalizeFriendsFocus("incoming"))
        assertEquals("incoming", MobileDeepLinks.normalizeFriendsFocus("inbox"))
        assertEquals("social_hub", MobileDeepLinks.normalizeFriendsFocus("social_hub"))
    }

    @Test
    fun consumeNavUri_friendsSocialHubInboxItem() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/friends?focus=social_hub&inbox_item_id=inbox-42")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("friends", captured!!.tabRoute)
        assertEquals("social_hub", captured!!.friendsFocus)
        assertEquals("inbox-42", captured!!.socialHubInboxItemId)
    }

    @Test
    fun navRouteForIncomingTab_rejectsUnknown() {
        assertNull(MobileDeepLinks.navRouteForIncomingTab("unknown"))
        assertNull(MobileDeepLinks.navRouteForIncomingTab(""))
    }

    @Test
    fun shellNavigationIntentForIncomingTab_desktopOpensNestedHub() {
        val intent = MobileDeepLinks.shellNavigationIntentForIncomingTab("desktop")
        requireNotNull(intent)
        assertEquals("ugs", intent.tabRoute)
        assertEquals("ugs/desktop", intent.nestedRoute)
    }

    @Test
    fun routeViaRouter_invalidTabReturnsInvalidTarget() {
        val uri = Uri.parse("world.empery.mobile:/nav/not-a-tab")
        val target = MobileDeepLinks.routeViaRouter(uri, "world.empery.mobile:/oauth2redirect")
        assertTrue(target is MobileDeepLinkTarget.Invalid)
    }

    @Test
    fun consumeNavUri_feedPostQuery_setsEwDeskPostId() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/feed?post=11111111-1111-1111-1111-111111111111")
        val consumed = MobileDeepLinks.consumeNavUri(
            uri = uri,
            oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
            onIntent = { captured = it },
        )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("feed", captured!!.tabRoute)
        assertEquals("11111111-1111-1111-1111-111111111111", captured!!.ewDeskPostId)
    }

    @Test
    fun consumeNavUri_notificationsQuery_setsNotificationId() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/notifications?notification_id=notif-legacy-1")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("notifications", captured!!.tabRoute)
        assertEquals("notif-legacy-1", captured!!.notificationId)
    }

    @Test
    fun consumeNavUri_chatQuery_setsChatId() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/chat?chat_id=22222222-2222-2222-2222-222222222222")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("chat", captured!!.tabRoute)
        assertEquals("22222222-2222-2222-2222-222222222222", captured!!.chatId)
    }

    @Test
    fun consumeNavUri_profileQuery_setsProfileSection() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/profile?section=ota")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("profile", captured!!.tabRoute)
        assertEquals("ota", captured!!.profileSection)
    }

    @Test
    fun consumeNavUri_ugsNestedRoute() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/ugs?nested=songs")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("ugs", captured!!.tabRoute)
        assertEquals("ugs/songs", captured!!.nestedRoute)
    }

    @Test
    fun consumeNavUri_ugsDesktopSection() {
        var captured: ShellNavigationIntent? = null
        val uri = Uri.parse("world.empery.mobile:/nav/desktop?section=store")
        val consumed =
            MobileDeepLinks.consumeNavUri(
                uri = uri,
                oauthRedirectUri = "world.empery.mobile:/oauth2redirect",
                onIntent = { captured = it },
            )
        assertTrue(consumed)
        requireNotNull(captured)
        assertEquals("ugs", captured!!.tabRoute)
        assertEquals("ugs/desktop", captured!!.nestedRoute)
        assertEquals("store", captured!!.desktopHubSection)
    }

    @Test
    fun parseLegacyTabQuery_tabEwaReturnsNull() {
        val uri = Uri.parse("world.empery.mobile:/oauth2redirect?tab=ewa")
        assertNull(MobileDeepLinks.parseLegacyTabQuery(uri))
    }

    @Test
    fun parseEmbeddedSpaDeepLink_tabEwaLegacyQuery() {
        val uri = Uri.parse("world.empery.mobile:/oauth2redirect?tab=ewa&operation=run-1")
        val link =
            MobileDeepLinks.parseEmbeddedSpaDeepLink(
                uri,
                "world.empery.mobile:/oauth2redirect",
            )
        requireNotNull(link)
        assertEquals(EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH, link.spaHash)
        assertTrue(link.hashQuery?.contains("operation=run-1") == true)
    }

    @Test
    fun parseEmbeddedSpaDeepLink_navEwaPath() {
        val uri = Uri.parse("world.empery.mobile:/nav/ewa?tools=1")
        val link =
            MobileDeepLinks.parseEmbeddedSpaDeepLink(
                uri,
                "world.empery.mobile:/oauth2redirect",
            )
        requireNotNull(link)
        assertEquals(EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH, link.spaHash)
        assertEquals("tools=1", link.hashQuery)
    }

    @Test
    fun parseLegacyTabQuery_tabDesktop() {
        val uri = Uri.parse("world.empery.mobile:/oauth2redirect?tab=desktop")
        val intent = MobileDeepLinks.parseLegacyTabQuery(uri)
        requireNotNull(intent)
        assertEquals("ugs", intent.tabRoute)
        assertEquals("ugs/desktop", intent.nestedRoute)
    }
}
