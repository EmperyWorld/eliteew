/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Custom scheme routing and notification extras; delegates typed parsing to MobileDeepLinkRouter.
 *
 * Invariants:
 * - Legacy `desktop` tab maps to UGS + nested desktop hub route.
 * - Social Hub `inbox` tab maps to Friends with `friendsFocus=incoming`.
 * - Friends nested `friends/action-center` opens relationship action center (W4 U2).
 *
 * Related:
 * - MobileDeepLinkRouter.kt, push/MobilePushNavigation.kt, SessionNavigationBridge
 */
package world.empery.mobile

import android.net.Uri
import feature.desktop.PendingEmbeddedSpaDeepLink
import feature.desktop.extractEwaCompanionHashQuery
import feature.desktop.isEmbeddedSpaIncomingTab
import feature.desktop.resolveEmbeddedSpaHashFromIncomingTab

private val EWDESK_POST_ID_REGEX =
    Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

/**
 * Resolved target for `scheme:/nav/...` UX + optional EWDesk UUID for deep links (FCM/custom URI).
 *
 * Example: ``world.empery.mobile.prod:/nav/feed?post=<uuid>`` → [tabRoute]=feed, [ewDeskPostId]=uuid
 */
data class ShellNavigationIntent(
    val tabRoute: String,
    val ewDeskPostId: String? = null,
    val friendRequestId: String? = null,
    val friendUserId: String? = null,
    val friendsFocus: String? = null,
    val notificationId: String? = null,
    /** GAF chat thread to open when [tabRoute] is `chat`. */
    val chatId: String? = null,
    /** Profile collapsible category key (`updates`, `account`, …) when [tabRoute] is `profile`. */
    val profileSection: String? = null,
    /** Social Hub inbox row to highlight when [tabRoute] is `friends`. */
    val socialHubInboxItemId: String? = null,
    /** Optional nested [NavHost] route after the tab (e.g. `ugs/desktop`, `friends/action-center`). */
    val nestedRoute: String? = null,
    /** Desktop Hub collapsible section when [nestedRoute] is `ugs/desktop`. */
    val desktopHubSection: String? = null,
) {
    init {
        require(MobileDeepLinks.isIncomingTabRoute(tabRoute))
    }
}

/**
 * Custom scheme routing (OAuth-family scheme per flavor) + notification extras.
 *
 * Tab-only: `/nav/desktop`, `/nav/feed`, …
 *
 * EWDesk post focus (optional):
 * - ``/nav/feed/<uuid>``
 * - ``/nav/feed/post/<uuid>``
 * - query ``post`` / ``postId`` / ``ewdesk_post`` (must be RFC-4122 UUID string)
 *
 * Payload keys for [Intent extras][android.content.Intent]:
 * [EXTRA_NAV_ROUTE] — lowercase tab (`feed`, …).
 * [EXTRA_EWDESK_POST_ID] — UUID when navigating to EWDesk (`feed`).
 */
object MobileDeepLinks {
    const val EXTRA_NAV_ROUTE = "world.empery.mobile.extra.NAV_ROUTE"
    const val EXTRA_EWDESK_POST_ID = "world.empery.mobile.extra.EWDESK_POST_ID"
    const val EXTRA_FRIEND_REQUEST_ID = "world.empery.mobile.extra.FRIEND_REQUEST_ID"
    const val EXTRA_FRIEND_USER_ID = "world.empery.mobile.extra.FRIEND_USER_ID"
    const val EXTRA_FRIENDS_FOCUS = "world.empery.mobile.extra.FRIENDS_FOCUS"
    const val EXTRA_NOTIFICATION_ID = "world.empery.mobile.extra.NOTIFICATION_ID"
    const val EXTRA_CHAT_ID = "world.empery.mobile.extra.CHAT_ID"
    const val EXTRA_PROFILE_SECTION = "world.empery.mobile.extra.PROFILE_SECTION"
    const val EXTRA_SOCIAL_HUB_INBOX_ITEM_ID = "world.empery.mobile.extra.SOCIAL_HUB_INBOX_ITEM_ID"
    const val EXTRA_UGS_NESTED_ROUTE = "world.empery.mobile.extra.UGS_NESTED_ROUTE"
    const val EXTRA_FRIENDS_NESTED_ROUTE = "world.empery.mobile.extra.FRIENDS_NESTED_ROUTE"
    const val EXTRA_DESKTOP_HUB_SECTION = "world.empery.mobile.extra.DESKTOP_HUB_SECTION"
    const val EXTRA_EMBEDDED_SPA_HASH_QUERY = "world.empery.mobile.extra.EMBEDDED_SPA_HASH_QUERY"

    /** Legacy FCM/deeplink tab keys (`desktop` alias for UGS). */
    val MAIN_TAB_ROUTES: Set<String> =
        setOf("desktop", "feed", "notifications", "chat", "friends", "profile")

    /** Accepted incoming tab keys including canonical in-app `ugs` and Social Hub `inbox` alias. */
    val INCOMING_TAB_ROUTES: Set<String> =
        MAIN_TAB_ROUTES + setOf("ugs", "inbox")

    /** NavHost bottom-tab and stack routes (canonical in-app routes). */
    val NAV_TAB_ROUTES: Set<String> =
        setOf("ugs", "feed", "notifications", "chat", "friends", "profile")

    /**
     * Maps FCM/deeplink tab keys to [NavHost] routes.
     * Legacy `desktop` opens the UGS tab (Desktop Hub is a nested route under UGS).
     */
    fun navRouteForIncomingTab(raw: String): String? =
        shellNavigationIntentForIncomingTab(raw)?.tabRoute

    fun shellNavigationIntentForIncomingTab(raw: String): ShellNavigationIntent? {
        val tab = raw.trim().lowercase()
        if (!isIncomingTabRoute(tab)) return null
        return when (tab) {
            "desktop" -> ShellNavigationIntent(tabRoute = "ugs", nestedRoute = "ugs/desktop")
            "inbox" ->
                ShellNavigationIntent(
                    tabRoute = "friends",
                    friendsFocus = "incoming",
                )
            else -> ShellNavigationIntent(tabRoute = tab)
        }
    }

    fun isIncomingTabRoute(route: String): Boolean = route.trim().lowercase() in INCOMING_TAB_ROUTES

    /** Push/deeplink tabs that open the Friends surface (canonical `friends` or Social Hub `inbox`). */
    fun isFriendsNavIncomingTab(route: String): Boolean {
        val tab = route.trim().lowercase()
        return tab == "friends" || tab == "inbox"
    }

    /** @deprecated Use [isIncomingTabRoute] for push/deeplink validation. */
    fun isMainTabRoute(route: String): Boolean = isIncomingTabRoute(route)

    /** Normalizes EWDesk identifiers from query/path segments or null when absent/invalid. */
    fun coerceEwDeskPostId(raw: String?): String? {
        val id = raw?.trim().orEmpty()
        if (!EWDESK_POST_ID_REGEX.matches(id)) return null
        return id.lowercase()
    }

    fun parseEwDeskPostSegment(pathSegment: String?): String? = coerceEwDeskPostId(pathSegment)

    fun coerceFriendRequestId(raw: String?): String? = coerceEwDeskPostId(raw)

    fun coerceFriendUserId(raw: String?): String? = coerceEwDeskPostId(raw)

    fun coerceNotificationId(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    fun coerceChatId(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    fun coerceProfileSection(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    fun coerceSocialHubInboxItemId(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    fun coerceDesktopHubSection(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() }

    fun normalizeFriendsFocus(raw: String?): String? =
        when (raw?.trim()?.lowercase()) {
            "request", "friend_request" -> "request"
            "incoming", "inbox" -> "incoming"
            "social_hub" -> "social_hub"
            "action_center", "action-center" -> "action_center"
            "friend", "friend_detail", "profile", "person" -> "friend_detail"
            else -> null
        }

    fun parseEwDeskPostUriQuery(uri: Uri): String? {
        coerceEwDeskPostId(uri.getQueryParameter("post"))?.let { return it }
        coerceEwDeskPostId(uri.getQueryParameter("post_id"))?.let { return it }
        coerceEwDeskPostId(uri.getQueryParameter("postId"))?.let { return it }
        coerceEwDeskPostId(uri.getQueryParameter("ewdesk_post"))?.let { return it }
        return null
    }

    /**
     * @param oauthRedirectUri app’s configured OAuth redirect (defines allowed scheme).
     * @return true if consumed as navigation (tab + optional EWDesk post id).
     */
    fun consumeNavUri(
        uri: Uri,
        oauthRedirectUri: String,
        onIntent: (ShellNavigationIntent) -> Unit,
    ): Boolean {
        routeViaRouter(uri, oauthRedirectUri)?.let { target ->
            if (target is MobileDeepLinkTarget.Invalid) return false
            MobileDeepLinkRouter.toShellIntent(target)?.let(onIntent)
            return true
        }
        val redirect = Uri.parse(oauthRedirectUri)
        if (!redirect.scheme.equals(uri.scheme, ignoreCase = true)) return false
        val segments = mobileUriPathSegments(uri)
        if (segments.size < 2 || !segments[0].equals("nav", ignoreCase = true)) {
            return false
        }

        val tab = segments[1].lowercase().trim()
        if (!isMainTabRoute(tab)) return false

        val ewDeskPostId =
            if (tab != "feed") {
                null
            } else {
                val fromPath =
                    when {
                        segments.size >= 4 &&
                            segments[2].equals("post", ignoreCase = true) ->
                            parseEwDeskPostSegment(segments[3])

                        segments.size >= 3 -> parseEwDeskPostSegment(segments[2])
                        else -> null
                    }

                when {
                    fromPath != null -> fromPath
                    else -> parseEwDeskPostUriQuery(uri)
                }
            }

        val friendRequestId =
            if (tab == "friends") {
                val fromPath =
                    when {
                        segments.size >= 4 &&
                            segments[2].equals("request", ignoreCase = true) ->
                            coerceFriendRequestId(segments[3])

                        else -> null
                    }
                fromPath ?: coerceFriendRequestId(uri.getQueryParameter("request_id"))
                    ?: coerceFriendRequestId(uri.getQueryParameter("requestId"))
            } else {
                null
            }
        val friendUserId =
            if (tab == "friends") {
                val fromPath =
                    when {
                        segments.size >= 4 &&
                            (
                                segments[2].equals("friend", ignoreCase = true) ||
                                    segments[2].equals("user", ignoreCase = true)
                            ) ->
                            coerceFriendUserId(segments[3])

                        else -> null
                    }
                fromPath ?: coerceFriendUserId(uri.getQueryParameter("friend_user_id"))
                    ?: coerceFriendUserId(uri.getQueryParameter("friendUserId"))
                    ?: coerceFriendUserId(uri.getQueryParameter("user_id"))
            } else {
                null
            }
        val friendsFocus =
            if (tab == "friends") {
                normalizeFriendsFocus(uri.getQueryParameter("focus"))
                    ?: when {
                        friendRequestId != null -> "request"
                        friendUserId != null -> "friend_detail"
                        else -> null
                    }
            } else {
                null
            }
        val notificationId =
            if (tab == "notifications") {
                coerceNotificationId(uri.getQueryParameter("notification_id"))
                    ?: coerceNotificationId(uri.getQueryParameter("notificationId"))
            } else {
                null
            }
        val chatId =
            if (tab == "chat") {
                coerceChatId(uri.getQueryParameter("chat_id"))
                    ?: coerceChatId(uri.getQueryParameter("chatId"))
            } else {
                null
            }
        val profileSection =
            if (tab == "profile") {
                coerceProfileSection(uri.getQueryParameter("section"))
                    ?: coerceProfileSection(uri.getQueryParameter("profile_section"))
            } else {
                null
            }
        val socialHubInboxItemId =
            if (tab == "friends") {
                coerceSocialHubInboxItemId(uri.getQueryParameter("inbox_item_id"))
                    ?: coerceSocialHubInboxItemId(uri.getQueryParameter("inboxItemId"))
                    ?: coerceSocialHubInboxItemId(uri.getQueryParameter("social_hub_item_id"))
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
                coerceDesktopHubSection(uri.getQueryParameter("section"))
                    ?: coerceDesktopHubSection(uri.getQueryParameter("desktop_section"))
                    ?: coerceDesktopHubSection(uri.getQueryParameter("hub_section"))
            } else {
                null
            }

        val navIntent = shellNavigationIntentForIncomingTab(tab) ?: return false
        val resolvedFriendsFocus =
            friendsFocus
                ?: when {
                    friendsNestedRoute == FRIENDS_ACTION_CENTER_ROUTE -> "action_center"
                    else -> null
                }
        val resolvedNested =
            ugsNestedRoute
                ?: friendsNestedRoute
                ?: when {
                    resolvedFriendsFocus == "action_center" -> FRIENDS_ACTION_CENTER_ROUTE
                    else -> null
                }
                ?: navIntent.nestedRoute
        onIntent(
            navIntent.copy(
                ewDeskPostId = ewDeskPostId,
                friendRequestId = friendRequestId,
                friendUserId = friendUserId,
                friendsFocus = resolvedFriendsFocus,
                notificationId = notificationId,
                chatId = chatId,
                profileSection = profileSection,
                socialHubInboxItemId = socialHubInboxItemId,
                nestedRoute = resolvedNested,
                desktopHubSection =
                    desktopHubSection?.takeIf {
                        resolvedNested == "ugs/desktop" || tab == "desktop"
                    },
            ),
        )
        return true
    }

    /** deeplink-001: parse `/nav/...` into typed [MobileDeepLinkTarget]. */
    fun routeViaRouter(uri: Uri, oauthRedirectUri: String): MobileDeepLinkTarget? =
        MobileDeepLinkRouter.fromNavUri(uri, oauthRedirectUri)

    /** deeplink-002: query `tab=desktop` legacy compat for FCM/web links. */
    fun parseLegacyTabQuery(uri: Uri): ShellNavigationIntent? {
        val tab = uri.getQueryParameter("tab")?.trim()?.lowercase().orEmpty()
        if (tab.isEmpty()) return null
        if (isEmbeddedSpaIncomingTab(tab)) return null
        return shellNavigationIntentForIncomingTab(tab)
    }

    /** Opens embedded SPA WebView (`tab=ewa`, `/nav/ewa`, `tab=companion`). */
    fun parseEmbeddedSpaDeepLink(uri: Uri, oauthRedirectUri: String): PendingEmbeddedSpaDeepLink? {
        parseLegacyEmbeddedSpaDeepLink(uri)?.let { return it }
        val redirect = Uri.parse(oauthRedirectUri)
        if (!redirect.scheme.equals(uri.scheme, ignoreCase = true)) return null
        val segments = mobileUriPathSegments(uri)
        if (segments.size < 2 || !segments[0].equals("nav", ignoreCase = true)) return null
        val tab = segments[1].lowercase().trim()
        val spaHash = resolveEmbeddedSpaHashFromIncomingTab(tab) ?: return null
        return PendingEmbeddedSpaDeepLink(
            spaHash = spaHash,
            hashQuery = extractEwaCompanionHashQuery(uri),
        )
    }

    private fun parseLegacyEmbeddedSpaDeepLink(uri: Uri): PendingEmbeddedSpaDeepLink? {
        val tab = uri.getQueryParameter("tab")?.trim()?.lowercase().orEmpty()
        val spaHash = resolveEmbeddedSpaHashFromIncomingTab(tab) ?: return null
        return PendingEmbeddedSpaDeepLink(
            spaHash = spaHash,
            hashQuery = extractEwaCompanionHashQuery(uri),
        )
    }

    private fun mobileUriPathSegments(uri: Uri): List<String> {
        val path = uri.path?.trim('/')?.takeIf { it.isNotEmpty() }
        if (path != null) {
            return path.split('/').map { it.trim() }.filter { it.isNotBlank() }
        }
        val ssp = uri.schemeSpecificPart ?: return emptyList()
        return ssp.substringBefore('?').substringBefore('#').trimStart('/').split('/').map {
            it.trim()
        }.filter { it.isNotBlank() }
    }
}
