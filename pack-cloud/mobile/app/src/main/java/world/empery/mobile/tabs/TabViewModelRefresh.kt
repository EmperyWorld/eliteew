package world.empery.mobile.tabs

import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.sync.MobileSyncStormGuard

/**
 * Refreshes all non-chat tabs after login or cold start with session.
 * Suppressed when [MobileSyncStormGuard] saw a sync within the debounce window (anti sync-storm).
 *
 * @param staggeredFollowUp true for post-tunnel-CONNECTED delayed refresh (CHAT already ran).
 * @return false when suppressed by the storm guard.
 */
fun refreshAllTabs(
    feed: FeedTabViewModel,
    notifications: NotificationsTabViewModel,
    profile: ProfileTabViewModel,
    friends: FriendsTabViewModel,
    ugs: UgsHubTabViewModel,
    staggeredFollowUp: Boolean = false,
): Boolean {
    if (!MobileSyncStormGuard.tryBeginSync(staggeredFollowUp = staggeredFollowUp)) {
        MobileTelemetry.trackBusinessEvent(
            "refresh_all_tabs_suppressed_sync_storm_guard",
            mapOf("staggered" to staggeredFollowUp.toString()),
        )
        return false
    }
    feed.refresh()
    notifications.refresh()
    profile.refresh()
    friends.refresh()
    ugs.refresh()
    return true
}
