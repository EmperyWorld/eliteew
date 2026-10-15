/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps push/deeplink Friends nested route keys to NavHost paths under the Friends tab.
 *
 * Invariants:
 * - Unknown keys return null (open Friends hub root only).
 * - Canonical action-center path is [FRIENDS_ACTION_CENTER_ROUTE].
 *
 * Related:
 * - MobileDeepLinkRouter.kt, MobileDeepLinks.kt, UgsDeepLinkSupport.kt
 */
package world.empery.mobile

/** Nested Social Hub relationship action center under Friends. */
const val FRIENDS_ACTION_CENTER_ROUTE = "friends/action-center"

/** Canonical nested NavHost route (`friends/action-center`, …) or null when absent/unknown. */
fun coerceFriendsNestedRoute(raw: String?): String? {
    val trimmed = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val lower = trimmed.lowercase()
    val normalized =
        when (lower) {
            "action-center",
            "action_center",
            "actioncenter",
            "relationship_action_center",
            "relationship-action-center",
            "social_hub_action_center",
            -> FRIENDS_ACTION_CENTER_ROUTE
            else -> trimmed
        }
    return when {
        normalized == FRIENDS_ACTION_CENTER_ROUTE -> FRIENDS_ACTION_CENTER_ROUTE
        normalized.startsWith("friends/") ->
            normalized.takeIf { it == FRIENDS_ACTION_CENTER_ROUTE }
        else -> null
    }
}
