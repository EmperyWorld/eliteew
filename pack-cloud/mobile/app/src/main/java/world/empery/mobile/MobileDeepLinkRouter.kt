/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * deeplink-001…003: canonical typed deeplink router for URI paths and FCM data payloads.
 *
 * Invariants:
 * - Legacy `tab=desktop` maps to UGS + nested desktop hub route.
 * - FCM `tab=inbox` maps to Friends with `focus=incoming`.
 *
 * Related:
 * - MobileDeepLinks.kt, push/MobilePushNavigation.kt, MOBILE-ANDROID-PUSH-DEEPLINK-REGISTRY.md
 */
package world.empery.mobile

import android.net.Uri
import world.empery.mobile.shell.MobileRouteRegistry

sealed class MobileDeepLinkTarget {
    abstract val tabRoute: String

    data class Feed(val postId: String? = null) : MobileDeepLinkTarget() {
        override val tabRoute: String = "feed"
    }

    data class Chat(val chatId: String? = null) : MobileDeepLinkTarget() {
        override val tabRoute: String = "chat"
    }

    data class Friends(
        val requestId: String? = null,
        val friendUserId: String? = null,
        val focus: String? = null,
        val inboxItemId: String? = null,
        val nestedRoute: String? = null,
    ) : MobileDeepLinkTarget() {
        override val tabRoute: String = "friends"
    }

    data class Notifications(val notificationId: String? = null) : MobileDeepLinkTarget() {
        override val tabRoute: String = "notifications"
    }

    data class Profile(val section: String? = null) : MobileDeepLinkTarget() {
        override val tabRoute: String = "profile"
    }

    data class Ugs(
        val nestedRoute: String? = null,
        val itemId: String? = null,
        val desktopHubSection: String? = null,
    ) : MobileDeepLinkTarget() {
        override val tabRoute: String = "ugs"
    }

    data class Invalid(val reason: String, val rawTab: String? = null) : MobileDeepLinkTarget() {
        override val tabRoute: String = MobileRouteRegistry.defaultStartRoute
    }
}

object MobileDeepLinkRouter {
    fun fromIncomingTab(
        rawTab: String,
        ewDeskPostId: String? = null,
        friendRequestId: String? = null,
        friendUserId: String? = null,
        friendsFocus: String? = null,
        chatId: String? = null,
        notificationId: String? = null,
        ugsItemId: String? = null,
        ugsNestedRoute: String? = null,
        profileSection: String? = null,
        socialHubInboxItemId: String? = null,
        desktopHubSection: String? = null,
        friendsNestedRoute: String? = null,
    ): MobileDeepLinkTarget {
        val tab = rawTab.trim().lowercase()
        if (!MobileDeepLinks.isIncomingTabRoute(tab)) {
            return MobileDeepLinkTarget.Invalid("unknown_tab", tab)
        }
        return when (tab) {
            "feed" -> MobileDeepLinkTarget.Feed(MobileDeepLinks.coerceEwDeskPostId(ewDeskPostId))
            "chat" -> MobileDeepLinkTarget.Chat(chatId?.trim()?.takeIf { it.isNotEmpty() })
            "inbox", "friends" -> {
                val focus =
                    MobileDeepLinks.normalizeFriendsFocus(friendsFocus)
                        ?: if (tab == "inbox") "incoming" else null
                val nested =
                    coerceFriendsNestedRoute(friendsNestedRoute)
                        ?: if (focus == "action_center") FRIENDS_ACTION_CENTER_ROUTE else null
                MobileDeepLinkTarget.Friends(
                    requestId = MobileDeepLinks.coerceFriendRequestId(friendRequestId),
                    friendUserId = MobileDeepLinks.coerceFriendUserId(friendUserId),
                    focus = focus ?: if (nested == FRIENDS_ACTION_CENTER_ROUTE) "action_center" else null,
                    inboxItemId = MobileDeepLinks.coerceSocialHubInboxItemId(socialHubInboxItemId),
                    nestedRoute = nested,
                )
            }
            "notifications" ->
                MobileDeepLinkTarget.Notifications(notificationId?.trim()?.takeIf { it.isNotEmpty() })
            "profile" -> MobileDeepLinkTarget.Profile(profileSection?.trim()?.takeIf { it.isNotEmpty() })
            "desktop", "ugs" ->
                MobileDeepLinkTarget.Ugs(
                    nestedRoute =
                        when (tab) {
                            "desktop" -> "ugs/desktop"
                            else -> coerceUgsNestedRoute(ugsNestedRoute)
                        },
                    itemId = ugsItemId?.trim()?.takeIf { it.isNotEmpty() },
                    desktopHubSection =
                        desktopHubSection?.trim()?.takeIf { it.isNotEmpty() }?.let { section ->
                            val nested =
                                when (tab) {
                                    "desktop" -> "ugs/desktop"
                                    else -> coerceUgsNestedRoute(ugsNestedRoute)
                                }
                            section.takeIf { nested == "ugs/desktop" }
                        },
                )
            else -> MobileDeepLinkTarget.Invalid("unsupported_tab", tab)
        }
    }

    /**
     * deeplink-003: parse FCM data-only navigation keys into a typed target.
     * Returns null when `tab` is absent or not in [MobileDeepLinks.INCOMING_TAB_ROUTES].
     */
    fun fromFcmData(data: Map<String, String>): MobileDeepLinkTarget? {
        val tab = data["tab"]?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        if (!MobileDeepLinks.isIncomingTabRoute(tab)) return null
        val ewDeskPostId =
            data["ewdesk_post_id"] ?: data["ewdesk_post"] ?: data["feed_post"]
        val friendRequestId =
            data["request_id"] ?: data["requestId"] ?: data["friend_request_id"]
        val friendUserId =
            data["friend_user_id"] ?: data["friendUserId"] ?: data["user_id"]
        val friendsFocus = friendsFocusFromFcmData(data, tab, friendRequestId, friendUserId)
        val notificationId = data["notification_id"] ?: data["notificationId"]
        val chatId = data["chat_id"] ?: data["chatId"]
        val profileSection = data["section"] ?: data["profile_section"]
        val socialHubInboxItemId =
            data["inbox_item_id"] ?: data["inboxItemId"] ?: data["social_hub_item_id"]
        val ugsNestedRoute = data["nested"] ?: data["route"] ?: data["ugs_route"]
        val friendsNestedRoute =
            if (MobileDeepLinks.isFriendsNavIncomingTab(tab)) {
                data["nested"] ?: data["route"] ?: data["friends_route"]
            } else {
                null
            }
        val desktopHubSection = desktopHubSectionFromFcmData(data, tab, ugsNestedRoute)
        return fromIncomingTab(
            rawTab = tab,
            ewDeskPostId = ewDeskPostId,
            friendRequestId = friendRequestId,
            friendUserId = friendUserId,
            friendsFocus = friendsFocus,
            chatId = chatId,
            notificationId = notificationId,
            profileSection = profileSection,
            socialHubInboxItemId = socialHubInboxItemId,
            ugsNestedRoute = ugsNestedRoute,
            desktopHubSection = desktopHubSection,
            friendsNestedRoute = friendsNestedRoute,
        )
    }

    fun fromNavUri(uri: Uri, oauthRedirectUri: String): MobileDeepLinkTarget? {
        val redirect = Uri.parse(oauthRedirectUri)
        if (!redirect.scheme.equals(uri.scheme, ignoreCase = true)) return null
        val segments = mobileUriPathSegments(uri)
        if (segments.size < 2 || !segments[0].equals("nav", ignoreCase = true)) return null
        val tab = segments[1].lowercase().trim()
        val ewDeskPostId =
            if (tab == "feed") {
                when {
                    segments.size >= 4 && segments[2].equals("post", ignoreCase = true) ->
                        MobileDeepLinks.parseEwDeskPostSegment(segments[3])
                    segments.size >= 3 -> MobileDeepLinks.parseEwDeskPostSegment(segments[2])
                    else -> MobileDeepLinks.parseEwDeskPostUriQuery(uri)
                }
            } else {
                null
            }
        val friendRequestId =
            if (tab == "friends") {
                when {
                    segments.size >= 4 && segments[2].equals("request", ignoreCase = true) ->
                        MobileDeepLinks.coerceFriendRequestId(segments[3])
                    else -> null
                } ?: MobileDeepLinks.coerceFriendRequestId(uri.getQueryParameter("request_id"))
                    ?: MobileDeepLinks.coerceFriendRequestId(uri.getQueryParameter("requestId"))
            } else {
                null
            }
        val friendUserId =
            if (tab == "friends") {
                when {
                    segments.size >= 4 &&
                        (segments[2].equals("friend", ignoreCase = true) || segments[2].equals("user", ignoreCase = true)) ->
                        MobileDeepLinks.coerceFriendUserId(segments[3])
                    else -> null
                } ?: MobileDeepLinks.coerceFriendUserId(uri.getQueryParameter("friend_user_id"))
                    ?: MobileDeepLinks.coerceFriendUserId(uri.getQueryParameter("friendUserId"))
            } else {
                null
            }
        val friendsFocus =
            if (tab == "friends") {
                MobileDeepLinks.normalizeFriendsFocus(uri.getQueryParameter("focus"))
                    ?: when {
                        friendRequestId != null -> "request"
                        friendUserId != null -> "friend_detail"
                        else -> null
                    }
            } else {
                null
            }
        val chatId =
            if (tab == "chat") {
                uri.getQueryParameter("chat_id") ?: uri.getQueryParameter("chatId")
            } else {
                null
            }
        val notificationId =
            if (tab == "notifications") {
                uri.getQueryParameter("notification_id") ?: uri.getQueryParameter("notificationId")
            } else {
                null
            }
        val ugsItemId =
            if (tab == "desktop" || tab == "ugs") {
                uri.getQueryParameter("item_id") ?: uri.getQueryParameter("itemId")
            } else {
                null
            }
        val profileSection =
            if (tab == "profile") {
                uri.getQueryParameter("section") ?: uri.getQueryParameter("profile_section")
            } else {
                null
            }
        val socialHubInboxItemId =
            if (tab == "friends") {
                uri.getQueryParameter("inbox_item_id")
                    ?: uri.getQueryParameter("inboxItemId")
                    ?: uri.getQueryParameter("social_hub_item_id")
            } else {
                null
            }
        val friendsNestedRoute =
            if (tab == "friends") {
                coerceFriendsNestedRoute(
                    when {
                        segments.size >= 3 &&
                            (
                                segments[2].equals("action-center", ignoreCase = true) ||
                                    segments[2].equals("action_center", ignoreCase = true)
                            ) -> segments[2]
                        else -> null
                    },
                )
                    ?: coerceFriendsNestedRoute(uri.getQueryParameter("nested"))
                    ?: coerceFriendsNestedRoute(uri.getQueryParameter("route"))
                    ?: coerceFriendsNestedRoute(uri.getQueryParameter("friends_route"))
            } else {
                null
            }
        val ugsNestedRoute =
            if (tab == "ugs" || tab == "desktop") {
                coerceUgsNestedRoute(uri.getQueryParameter("nested"))
                    ?: coerceUgsNestedRoute(uri.getQueryParameter("route"))
                    ?: coerceUgsNestedRoute(uri.getQueryParameter("ugs_route"))
            } else {
                null
            }
        val desktopHubSection =
            if (tab == "ugs" || tab == "desktop") {
                MobileDeepLinks.coerceDesktopHubSection(uri.getQueryParameter("section"))
                    ?: MobileDeepLinks.coerceDesktopHubSection(uri.getQueryParameter("desktop_section"))
                    ?: MobileDeepLinks.coerceDesktopHubSection(uri.getQueryParameter("hub_section"))
            } else {
                null
            }
        return fromIncomingTab(
            rawTab = tab,
            ewDeskPostId = ewDeskPostId,
            friendRequestId = friendRequestId,
            friendUserId = friendUserId,
            friendsFocus = friendsFocus,
            chatId = chatId,
            notificationId = notificationId,
            ugsItemId = ugsItemId,
            ugsNestedRoute = ugsNestedRoute,
            profileSection = profileSection,
            socialHubInboxItemId = socialHubInboxItemId,
            desktopHubSection = desktopHubSection,
            friendsNestedRoute = friendsNestedRoute,
        )
    }

    fun toShellIntent(target: MobileDeepLinkTarget): ShellNavigationIntent? =
        when (target) {
            is MobileDeepLinkTarget.Invalid -> null
            is MobileDeepLinkTarget.Feed ->
                ShellNavigationIntent(tabRoute = "feed", ewDeskPostId = target.postId)
            is MobileDeepLinkTarget.Chat ->
                ShellNavigationIntent(
                    tabRoute = "chat",
                    chatId = target.chatId,
                )
            is MobileDeepLinkTarget.Friends ->
                ShellNavigationIntent(
                    tabRoute = "friends",
                    friendRequestId = target.requestId,
                    friendUserId = target.friendUserId,
                    friendsFocus = target.focus,
                    socialHubInboxItemId = target.inboxItemId,
                    nestedRoute = target.nestedRoute,
                )
            is MobileDeepLinkTarget.Notifications ->
                ShellNavigationIntent(
                    tabRoute = "notifications",
                    notificationId = target.notificationId,
                )
            is MobileDeepLinkTarget.Profile ->
                ShellNavigationIntent(
                    tabRoute = "profile",
                    profileSection = target.section,
                )
            is MobileDeepLinkTarget.Ugs ->
                ShellNavigationIntent(
                    tabRoute = "ugs",
                    nestedRoute = target.nestedRoute,
                    desktopHubSection = target.desktopHubSection,
                )
        }

    fun previewLabel(target: MobileDeepLinkTarget): String =
        when (target) {
            is MobileDeepLinkTarget.Feed -> "feed${target.postId?.let { "/post/$it" } ?: ""}"
            is MobileDeepLinkTarget.Chat -> "chat${target.chatId?.let { "/$it" } ?: ""}"
            is MobileDeepLinkTarget.Friends ->
                "friends" +
                    (
                        target.nestedRoute?.let { "/${it.substringAfter("friends/")}" }
                            ?: target.requestId?.let { "/request/$it" }
                            ?: target.friendUserId?.let { "/friend/$it" }
                            ?: ""
                    )
            is MobileDeepLinkTarget.Notifications -> "notifications"
            is MobileDeepLinkTarget.Profile -> "profile"
            is MobileDeepLinkTarget.Ugs -> target.nestedRoute ?: "ugs"
            is MobileDeepLinkTarget.Invalid -> "invalid:${target.reason}"
        }

    private fun friendsFocusFromFcmData(
        data: Map<String, String>,
        tab: String,
        friendRequestId: String?,
        friendUserId: String?,
    ): String? =
        MobileDeepLinks.normalizeFriendsFocus(data["focus"])
            ?: when (data["kind"]?.trim()?.lowercase()) {
                "friend_request_received" -> "request"
                "friend_request_accepted" -> "friend_detail"
                else -> null
            }
            ?: tab.takeIf { it == "inbox" }?.let { "incoming" }
            ?: if (MobileDeepLinks.isFriendsNavIncomingTab(tab)) {
                when {
                    MobileDeepLinks.coerceFriendRequestId(friendRequestId) != null -> "request"
                    MobileDeepLinks.coerceFriendUserId(friendUserId) != null -> "friend_detail"
                    else -> null
                }
            } else {
                null
            }

    private fun desktopHubSectionFromFcmData(
        data: Map<String, String>,
        tab: String,
        ugsNestedRoute: String?,
    ): String? {
        val nested = coerceUgsNestedRoute(ugsNestedRoute)
        val onDesktopHub = tab == "desktop" || tab == "ugs" && nested == "ugs/desktop"
        if (!onDesktopHub) return null
        return MobileDeepLinks.coerceDesktopHubSection(
            data["desktop_section"] ?: data["hub_section"] ?: data["section"],
        )
    }

    private fun mobileUriPathSegments(uri: Uri): List<String> {
        val path = uri.path?.trim('/')?.takeIf { it.isNotEmpty() }
        if (path != null) {
            return path.split('/').map { it.trim() }.filter { it.isNotBlank() }
        }
        val ssp = uri.schemeSpecificPart ?: return emptyList()
        return ssp.substringBefore('?').substringBefore('#').trimStart('/').split('/').map { it.trim() }
            .filter { it.isNotBlank() }
    }
}
