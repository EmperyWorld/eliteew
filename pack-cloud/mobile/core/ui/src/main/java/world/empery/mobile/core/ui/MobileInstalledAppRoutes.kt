/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps desktop store `app_id` values to native mobile shell bottom-tab routes.
 *
 * Invariants:
 * - Unknown ids fall back to UGS hub tab (same as EWDesk deep links).
 *
 * Related:
 * - MobileRouteRegistry, DesktopHubFeature.kt, FeedFeature.kt
 */
package world.empery.mobile.core.ui

object MobileInstalledAppRoutes {
    fun bottomTabRouteForStoreAppId(appId: String): String =
        when (appId.trim()) {
            "GAFChatApp" -> "chat"
            "UGSHubApp" -> "ugs"
            "FriendsApp" -> "friends"
            "ProfileApp" -> "profile"
            "EwDeskApp", "NewsApp", "FeedApp" -> "feed"
            else -> "ugs"
        }
}
