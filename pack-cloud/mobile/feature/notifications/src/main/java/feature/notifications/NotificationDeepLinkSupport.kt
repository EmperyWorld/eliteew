/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure deeplink helpers for Notification Center (`tab=notifications`, `notification_id`).
 *
 * Invariants:
 * - No Android Context; safe for JVM unit tests.
 * - Unknown or missing ids still set focus id for scroll retry after refresh.
 *
 * Related:
 * - NotificationsTabViewModel.handleDeepLink, MobileDeepLinks.kt, NotificationFeature.kt
 */
package feature.notifications

import world.empery.mobile.core.storage.NotificationEntity

/** Parent surface for optional context strip when Notification Center is not the bottom tab. */
enum class NotificationCenterEntrySurface {
    EW_DESK,
    PROFILE,
}

fun coerceNotificationId(raw: String?): String? =
    raw?.trim()?.takeIf { it.isNotEmpty() }

data class NotificationDeepLinkResult(
    val focusedNotificationId: String?,
    val detailItem: NotificationEntity?,
    /** Index in flattened lazy list (group headers + rows); null when id not in filtered set. */
    val listScrollIndex: Int?,
)

/**
 * Resolves push/deeplink focus after inbox items are loaded or read from cache.
 * Opens detail sheet when a matching row exists.
 */
fun resolveNotificationDeepLinkFocus(
    rawNotificationId: String?,
    items: List<NotificationEntity>,
    filter: NotificationFilter = NotificationFilter.ALL,
): NotificationDeepLinkResult {
    val notificationId = coerceNotificationId(rawNotificationId)
        ?: return NotificationDeepLinkResult(null, null, null)
    val filtered = filterNotifications(items, filter)
    val match = filtered.firstOrNull { row -> row.id == notificationId }
        ?: items.firstOrNull { row -> row.id == notificationId }
    val groups = groupInboxBySourceAndSeverity(filtered)
    val scrollIndex = findNotificationListScrollIndex(groups, notificationId)
    return NotificationDeepLinkResult(
        focusedNotificationId = notificationId,
        detailItem = match,
        listScrollIndex = scrollIndex,
    )
}

/** Flat lazy-list index for [notificationId] inside grouped inbox rows (headers count). */
fun findNotificationListScrollIndex(
    groups: List<InboxGroup>,
    notificationId: String,
): Int? {
    val id = coerceNotificationId(notificationId) ?: return null
    var index = 0
    for (group in groups) {
        index += 1 // group header
        for (item in group.items) {
            if (item.id == id) return index
            index += 1
        }
    }
    return null
}
