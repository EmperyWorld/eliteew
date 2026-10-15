package world.empery.mobile

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MobileDeepLinkRouterTest {
    private val oauthRedirect = "world.empery.mobile:/oauth2redirect"

    @Test
    fun fromNavUri_friendsActionCenterPath() {
        val uri = Uri.parse("world.empery.mobile:/nav/friends/action-center")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Friends)
        val friends = target as MobileDeepLinkTarget.Friends
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, friends.nestedRoute)
        assertEquals("action_center", friends.focus)
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("friends", intent.tabRoute)
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, intent.nestedRoute)
    }

    @Test
    fun fromFcmData_friendsActionCenterFocus() {
        val target =
            MobileDeepLinkRouter.fromFcmData(
                mapOf(
                    "tab" to "friends",
                    "focus" to "action_center",
                ),
            )
        assertTrue(target is MobileDeepLinkTarget.Friends)
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, (target as MobileDeepLinkTarget.Friends).nestedRoute)
    }

    @Test
    fun fromIncomingTab_desktopMapsToUgsNestedHub() {
        val target = MobileDeepLinkRouter.fromIncomingTab("desktop")
        assertTrue(target is MobileDeepLinkTarget.Ugs)
        assertEquals("ugs/desktop", (target as MobileDeepLinkTarget.Ugs).nestedRoute)
    }

    @Test
    fun fromNavUri_friendsRequestPreview() {
        val uri = Uri.parse("world.empery.mobile:/nav/friends/request/22222222-2222-2222-2222-222222222222")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Friends)
        assertEquals("22222222-2222-2222-2222-222222222222", (target as MobileDeepLinkTarget.Friends).requestId)
    }

    @Test
    fun fromIncomingTab_inboxMapsToFriendsIncomingFocus() {
        val target = MobileDeepLinkRouter.fromIncomingTab("inbox")
        assertTrue(target is MobileDeepLinkTarget.Friends)
        assertEquals("incoming", (target as MobileDeepLinkTarget.Friends).focus)
    }

    @Test
    fun toShellIntent_notificationsCarriesNotificationId() {
        val target =
            MobileDeepLinkTarget.Notifications(notificationId = "notif-abc-123")
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("notifications", intent.tabRoute)
        assertEquals("notif-abc-123", intent.notificationId)
    }

    @Test
    fun fromNavUri_notificationsQueryNotificationId() {
        val uri =
            Uri.parse("world.empery.mobile:/nav/notifications?notification_id=notif-xyz-456")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Notifications)
        assertEquals("notif-xyz-456", (target as MobileDeepLinkTarget.Notifications).notificationId)
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("notif-xyz-456", intent.notificationId)
    }

    @Test
    fun toShellIntent_chatCarriesChatId() {
        val target = MobileDeepLinkTarget.Chat(chatId = "chat-thread-42")
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("chat", intent.tabRoute)
        assertEquals("chat-thread-42", intent.chatId)
    }

    @Test
    fun fromNavUri_chatQueryChatId() {
        val uri = Uri.parse("world.empery.mobile:/nav/chat?chat_id=11111111-1111-1111-1111-111111111111")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Chat)
        assertEquals("11111111-1111-1111-1111-111111111111", (target as MobileDeepLinkTarget.Chat).chatId)
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("11111111-1111-1111-1111-111111111111", intent.chatId)
    }

    @Test
    fun toShellIntent_profileCarriesSection() {
        val target = MobileDeepLinkTarget.Profile(section = "updates")
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("profile", intent.tabRoute)
        assertEquals("updates", intent.profileSection)
    }

    @Test
    fun fromNavUri_profileQuerySection() {
        val uri = Uri.parse("world.empery.mobile:/nav/profile?section=updates")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Profile)
        assertEquals("updates", (target as MobileDeepLinkTarget.Profile).section)
    }

    @Test
    fun toShellIntent_ugsCarriesNestedRoute() {
        val target = MobileDeepLinkTarget.Ugs(nestedRoute = "ugs/songs")
        val intent = MobileDeepLinkRouter.toShellIntent(target)
        requireNotNull(intent)
        assertEquals("ugs", intent.tabRoute)
        assertEquals("ugs/songs", intent.nestedRoute)
    }

    @Test
    fun fromNavUri_ugsQueryNested() {
        val uri = Uri.parse("world.empery.mobile:/nav/ugs?nested=chat")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Ugs)
        assertEquals("ugs/chat", (target as MobileDeepLinkTarget.Ugs).nestedRoute)
    }

    @Test
    fun fromNavUri_ugsDesktopSection() {
        val uri = Uri.parse("world.empery.mobile:/nav/ugs?nested=desktop&section=store")
        val target = MobileDeepLinkRouter.fromNavUri(uri, oauthRedirect)
        assertTrue(target is MobileDeepLinkTarget.Ugs)
        val ugs = target as MobileDeepLinkTarget.Ugs
        assertEquals("ugs/desktop", ugs.nestedRoute)
        assertEquals("store", ugs.desktopHubSection)
    }

    @Test
    fun previewLabel_and_toShellIntent() {
        assertEquals("profile", MobileDeepLinkRouter.previewLabel(MobileDeepLinkTarget.Profile()))
        val intent = MobileDeepLinkRouter.toShellIntent(MobileDeepLinkTarget.Feed(postId = "11111111-1111-1111-1111-111111111111"))
        requireNotNull(intent)
        assertEquals("feed", intent.tabRoute)
    }

    // DEBT-SH-04/05, AND-03/04/05 — FCM push→screen matrix (deeplink-003)

    @Test
    fun fromFcmData_inboxTabIncomingFocus() {
        val target = MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "inbox"))
        assertTrue(target is MobileDeepLinkTarget.Friends)
        assertEquals("incoming", (target as MobileDeepLinkTarget.Friends).focus)
    }

    @Test
    fun fromFcmData_friendsRequestFocus() {
        val requestId = "11111111-1111-1111-1111-111111111111"
        val target =
            MobileDeepLinkRouter.fromFcmData(
                mapOf(
                    "tab" to "friends",
                    "request_id" to requestId,
                    "kind" to "friend_request_received",
                ),
            )
        assertTrue(target is MobileDeepLinkTarget.Friends)
        val friends = target as MobileDeepLinkTarget.Friends
        assertEquals("request", friends.focus)
        assertEquals(requestId, friends.requestId)
    }

    @Test
    fun fromFcmData_friendsSocialHubInboxItem() {
        val target =
            MobileDeepLinkRouter.fromFcmData(
                mapOf(
                    "tab" to "friends",
                    "focus" to "social_hub",
                    "inbox_item_id" to "inbox-row-99",
                ),
            )
        assertTrue(target is MobileDeepLinkTarget.Friends)
        val friends = target as MobileDeepLinkTarget.Friends
        assertEquals("social_hub", friends.focus)
        assertEquals("inbox-row-99", friends.inboxItemId)
    }

    @Test
    fun fromFcmData_chatThread() {
        val chatId = "22222222-2222-2222-2222-222222222222"
        val target = MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "chat", "chat_id" to chatId))
        assertTrue(target is MobileDeepLinkTarget.Chat)
        assertEquals(chatId, (target as MobileDeepLinkTarget.Chat).chatId)
    }

    @Test
    fun fromFcmData_notificationsItem() {
        val target =
            MobileDeepLinkRouter.fromFcmData(
                mapOf("tab" to "notifications", "notification_id" to "notif-push-7"),
            )
        assertTrue(target is MobileDeepLinkTarget.Notifications)
        assertEquals("notif-push-7", (target as MobileDeepLinkTarget.Notifications).notificationId)
    }

    @Test
    fun fromFcmData_profileSection() {
        val target = MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "profile", "section" to "updates"))
        assertTrue(target is MobileDeepLinkTarget.Profile)
        assertEquals("updates", (target as MobileDeepLinkTarget.Profile).section)
    }

    @Test
    fun fromFcmData_desktopNestedHubSection() {
        val target =
            MobileDeepLinkRouter.fromFcmData(
                mapOf(
                    "tab" to "desktop",
                    "desktop_section" to "store",
                ),
            )
        assertTrue(target is MobileDeepLinkTarget.Ugs)
        val ugs = target as MobileDeepLinkTarget.Ugs
        assertEquals("ugs/desktop", ugs.nestedRoute)
        assertEquals("store", ugs.desktopHubSection)
    }

    @Test
    fun fromFcmData_ugsNestedChat() {
        val target = MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "ugs", "nested" to "chat"))
        assertTrue(target is MobileDeepLinkTarget.Ugs)
        assertEquals("ugs/chat", (target as MobileDeepLinkTarget.Ugs).nestedRoute)
    }

    @Test
    fun fromFcmData_feedPostAlias() {
        val postId = "33333333-3333-3333-3333-333333333333"
        val target = MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "feed", "feed_post" to postId))
        assertTrue(target is MobileDeepLinkTarget.Feed)
        assertEquals(postId, (target as MobileDeepLinkTarget.Feed).postId)
    }

    @Test
    fun fromFcmData_unknownTabReturnsNull() {
        assertNull(MobileDeepLinkRouter.fromFcmData(mapOf("tab" to "marketing")))
        assertNull(MobileDeepLinkRouter.fromFcmData(emptyMap()))
    }
}
