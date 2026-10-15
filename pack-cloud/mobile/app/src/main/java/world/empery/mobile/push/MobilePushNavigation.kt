/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Push→screen contract: FCM data and local notification params → MainActivity intent extras.
 *
 * Invariants:
 * - [EXTRA_NAV_ROUTE] keeps the raw incoming tab key (`inbox`, `desktop`, …) for MainActivity.
 * - Tab-scoped extras are omitted when the incoming tab does not match the surface.
 *
 * Related:
 * - MobileDeepLinkRouter.kt, MobileDeepLinks.kt, MOBILE-ANDROID-PUSH-DEEPLINK-REGISTRY.md
 */
package world.empery.mobile.push

import android.content.Context
import android.content.Intent
import feature.desktop.extractEwaCompanionHashQueryFromData
import feature.desktop.resolveEmbeddedSpaHashFromIncomingTab
import world.empery.mobile.FRIENDS_ACTION_CENTER_ROUTE
import world.empery.mobile.MainActivity
import world.empery.mobile.MobileDeepLinkRouter
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.ShellNavigationIntent
import world.empery.mobile.coerceFriendsNestedRoute

/**
 * Push→screen matrix (FCM `tab` + optional keys → intent extras):
 *
 * | tab / alias | Screen | Optional keys |
 * |-------------|--------|---------------|
 * | `feed` | EWDesk feed | `ewdesk_post_id`, `ewdesk_post`, `feed_post` |
 * | `chat` | GAF chat list + thread | `chat_id` / `chatId` |
 * | `friends` | Friends tab (+ nested action-center) | `request_id`, `friend_user_id`, `focus`, `inbox_item_id`, `nested`/`friends_route` |
 * | `inbox` | Friends + incoming focus | same as friends; default `focus=incoming` |
 * | `notifications` | Notification Center | `notification_id` / `notificationId` |
 * | `profile` | Profile accordion | `section`, `profile_section` |
 * | `desktop` | UGS + Desktop Hub | `nested`/`route`/`ugs_route`, `section`/`desktop_section` |
 * | `ugs` | UGS tab + nested tool | `nested`/`route`/`ugs_route`, hub `section` when nested=desktop |
 * | `ewa`, `companion` | EWA companion WebView | `operation`/`run`, `tools`, `open`, `phrases`, `workflows` |
 */
object MobilePushNavigation {
    fun shellIntentFromFcmData(data: Map<String, String>): ShellNavigationIntent? {
        val target = MobileDeepLinkRouter.fromFcmData(data) ?: return null
        return MobileDeepLinkRouter.toShellIntent(target)
    }

    fun buildMainActivityIntent(
        context: Context,
        rawTab: String,
        shell: ShellNavigationIntent,
    ): Intent =
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            applyShellNavigationExtras(this, rawTab.trim().lowercase(), shell)
        }

    fun buildMainActivityIntentFromFcmData(
        context: Context,
        data: Map<String, String>,
    ): Intent? {
        val rawTab = data["tab"]?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        resolveEmbeddedSpaHashFromIncomingTab(rawTab)?.let {
            return Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(MobileDeepLinks.EXTRA_NAV_ROUTE, rawTab)
                extractEwaCompanionHashQueryFromData(data)?.let { hashQuery ->
                    putExtra(MobileDeepLinks.EXTRA_EMBEDDED_SPA_HASH_QUERY, hashQuery)
                }
            }
        }
        val shell = shellIntentFromFcmData(data) ?: return null
        return buildMainActivityIntent(context, rawTab, shell)
    }

    fun applyShellNavigationExtras(
        intent: Intent,
        rawTab: String,
        shell: ShellNavigationIntent,
    ) {
        if (!MobileDeepLinks.isIncomingTabRoute(rawTab)) return
        intent.putExtra(MobileDeepLinks.EXTRA_NAV_ROUTE, rawTab)

        shell.ewDeskPostId?.takeIf { rawTab == "feed" }?.let { postId ->
            intent.putExtra(MobileDeepLinks.EXTRA_EWDESK_POST_ID, postId)
        }

        if (MobileDeepLinks.isFriendsNavIncomingTab(rawTab)) {
            shell.friendRequestId?.let { intent.putExtra(MobileDeepLinks.EXTRA_FRIEND_REQUEST_ID, it) }
            shell.friendUserId?.let { intent.putExtra(MobileDeepLinks.EXTRA_FRIEND_USER_ID, it) }
            val focus =
                shell.friendsFocus
                    ?: MobileDeepLinks.shellNavigationIntentForIncomingTab(rawTab)?.friendsFocus
            focus?.let { intent.putExtra(MobileDeepLinks.EXTRA_FRIENDS_FOCUS, it) }
            shell.socialHubInboxItemId?.let { inboxItemId ->
                intent.putExtra(MobileDeepLinks.EXTRA_SOCIAL_HUB_INBOX_ITEM_ID, inboxItemId)
            }
            val friendsNested =
                coerceFriendsNestedRoute(shell.nestedRoute)
                    ?: if (focus == "action_center") FRIENDS_ACTION_CENTER_ROUTE else null
            friendsNested?.let { intent.putExtra(MobileDeepLinks.EXTRA_FRIENDS_NESTED_ROUTE, it) }
        }

        if (rawTab == "notifications" || shell.tabRoute == "notifications") {
            shell.notificationId?.let { intent.putExtra(MobileDeepLinks.EXTRA_NOTIFICATION_ID, it) }
        }

        if (rawTab == "chat" || shell.tabRoute == "chat") {
            shell.chatId?.let { intent.putExtra(MobileDeepLinks.EXTRA_CHAT_ID, it) }
        }

        if (rawTab == "profile" || shell.tabRoute == "profile") {
            shell.profileSection?.let { intent.putExtra(MobileDeepLinks.EXTRA_PROFILE_SECTION, it) }
        }

        if (rawTab == "ugs" || rawTab == "desktop" || shell.tabRoute == "ugs") {
            val nested =
                shell.nestedRoute
                    ?: MobileDeepLinks.shellNavigationIntentForIncomingTab(rawTab)?.nestedRoute
            nested?.let { intent.putExtra(MobileDeepLinks.EXTRA_UGS_NESTED_ROUTE, it) }
            shell.desktopHubSection?.let { section ->
                intent.putExtra(MobileDeepLinks.EXTRA_DESKTOP_HUB_SECTION, section)
            }
        }
    }

    fun shellIntentFromNotificationParams(
        tab: String?,
        ewDeskPostId: String? = null,
        friendRequestId: String? = null,
        friendUserId: String? = null,
        friendsFocus: String? = null,
        targetNotificationId: String? = null,
        targetChatId: String? = null,
        targetProfileSection: String? = null,
        targetSocialHubInboxItemId: String? = null,
        targetUgsNestedRoute: String? = null,
        targetDesktopHubSection: String? = null,
    ): ShellNavigationIntent? {
        val rawTab = tab?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        if (!MobileDeepLinks.isIncomingTabRoute(rawTab)) return null
        val data =
            buildMap {
                put("tab", rawTab)
                ewDeskPostId?.let { put("ewdesk_post_id", it) }
                friendRequestId?.let { put("request_id", it) }
                friendUserId?.let { put("friend_user_id", it) }
                friendsFocus?.let { put("focus", it) }
                targetNotificationId?.let { put("notification_id", it) }
                targetChatId?.let { put("chat_id", it) }
                targetProfileSection?.let { put("section", it) }
                targetSocialHubInboxItemId?.let { put("inbox_item_id", it) }
                targetUgsNestedRoute?.let { put("nested", it) }
                targetDesktopHubSection?.let { put("desktop_section", it) }
            }
        return shellIntentFromFcmData(data)
    }

    fun buildMainActivityIntentFromNotificationParams(
        context: Context,
        tab: String?,
        ewDeskPostId: String? = null,
        friendRequestId: String? = null,
        friendUserId: String? = null,
        friendsFocus: String? = null,
        targetNotificationId: String? = null,
        targetChatId: String? = null,
        targetProfileSection: String? = null,
        targetSocialHubInboxItemId: String? = null,
        targetUgsNestedRoute: String? = null,
        targetDesktopHubSection: String? = null,
    ): Intent? {
        val rawTab = tab?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        val shell =
            shellIntentFromNotificationParams(
                tab = rawTab,
                ewDeskPostId = ewDeskPostId,
                friendRequestId = friendRequestId,
                friendUserId = friendUserId,
                friendsFocus = friendsFocus,
                targetNotificationId = targetNotificationId,
                targetChatId = targetChatId,
                targetProfileSection = targetProfileSection,
                targetSocialHubInboxItemId = targetSocialHubInboxItemId,
                targetUgsNestedRoute = targetUgsNestedRoute,
                targetDesktopHubSection = targetDesktopHubSection,
            ) ?: return null
        return buildMainActivityIntent(context, rawTab, shell)
    }
}
