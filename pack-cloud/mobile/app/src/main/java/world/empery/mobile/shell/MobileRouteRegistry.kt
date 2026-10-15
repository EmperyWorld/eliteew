/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical route registry for bottom tabs, nested UGS/notification flows, and deeplink targets.
 *
 * Invariants:
 * - Bottom tab routes match RootTab entries; nested routes are shell-only (no bottom bar slot).
 * - `notifications` is a bottom tab (W4 U6); deeplink `tab=notifications` coerces to that tab.
 * - Deeplink tab coercion delegates to MobileDeepLinks (T17); registry does not parse URIs.
 *
 * Related:
 * - MobileBackStackPolicy.kt, MobileDeepLinks.kt, MOBILE-ANDROID-ADAPTIVE-LAYOUT.md
 */
package world.empery.mobile.shell

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.ui.graphics.vector.ImageVector
import world.empery.mobile.FRIENDS_ACTION_CENTER_ROUTE
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.R
import world.empery.mobile.ShellNavigationIntent

/**
 * Bottom navigation tabs for the authenticated shell.
 *
 * Note: [Ugs] is reached via the center EW hub slot in chrome; [Notifications] is a first-class tab
 * (perfection W4 U6 / Decision §8).
 */
enum class RootTab(
    val route: String,
    val titleRes: Int,
    val iconSelected: ImageVector,
    val iconUnselected: ImageVector,
) {
    Feed(
        "feed",
        R.string.tab_feed,
        Icons.Filled.Newspaper,
        Icons.Outlined.Newspaper,
    ),
    Chat(
        "chat",
        R.string.tab_chat,
        Icons.Filled.Forum,
        Icons.Outlined.Forum,
    ),
    Ugs(
        "ugs",
        R.string.tab_desktop,
        Icons.Filled.AutoAwesome,
        Icons.Outlined.AutoAwesome,
    ),
    Notifications(
        "notifications",
        R.string.tab_notifications,
        Icons.Filled.Notifications,
        Icons.Outlined.Notifications,
    ),
    Friends(
        "friends",
        R.string.tab_friends,
        Icons.Filled.Group,
        Icons.Outlined.Group,
    ),
    Profile(
        "profile",
        R.string.tab_profile,
        Icons.Filled.Person,
        Icons.Outlined.Person,
    ),
    ;

    companion object {
        private val byRoute = entries.associateBy { it.route }

        fun fromRoute(route: String?): RootTab? = route?.let { byRoute[it] }
    }
}

/**
 * Canonical route registry for bottom tabs, nested UGS/notification flows, and deeplink targets.
 */
object MobileRouteRegistry {
    val bottomTabs: List<RootTab> = RootTab.entries

    val bottomTabRoutes: Set<String> = bottomTabs.map { it.route }.toSet()

    /** Routes registered in [NavHost] but not shown in the bottom bar. */
    val nestedShellRoutes: Set<String> =
        setOf(
            "ugs/chat",
            "ugs/images",
            "ugs/songs",
            "ugs/presentations",
            "ugs/desktop",
            "ugs/content",
            FRIENDS_ACTION_CENTER_ROUTE,
        )

    /** Prefixes for parameterized nested routes (e.g. `ugs/chat/{id}`). */
    val nestedRoutePrefixes: List<String> =
        listOf(
            "ugs/chat/",
        )

    val defaultStartRoute: String = RootTab.Feed.route

    fun isBottomTabRoute(route: String?): Boolean = route != null && route in bottomTabRoutes

    fun isKnownShellRoute(route: String?): Boolean {
        if (route.isNullOrBlank()) return false
        if (isBottomTabRoute(route)) return true
        if (route in nestedShellRoutes) return true
        return nestedRoutePrefixes.any { route.startsWith(it) }
    }

    fun isNestedRoute(route: String?): Boolean = route != null && !isBottomTabRoute(route) && isKnownShellRoute(route)

    fun resolveTabFromRoute(route: String?): RootTab? = RootTab.fromRoute(route)

    fun resolveTabRouteForIncoming(raw: String): String? = MobileDeepLinks.navRouteForIncomingTab(raw)

    fun shellIntentForIncomingTab(raw: String): ShellNavigationIntent? =
        MobileDeepLinks.shellNavigationIntentForIncomingTab(raw)

    fun coerceBottomTabRoute(route: String?): String? {
        val normalized = route?.trim()?.lowercase().orEmpty()
        if (normalized.isEmpty()) return null
        if (isBottomTabRoute(normalized)) return normalized
        resolveTabRouteForIncoming(normalized)?.let { incoming ->
            if (isBottomTabRoute(incoming)) return incoming
        }
        return null
    }

    fun telemetryRouteName(route: String?): String = route?.takeIf { it.isNotBlank() } ?: defaultStartRoute
}
