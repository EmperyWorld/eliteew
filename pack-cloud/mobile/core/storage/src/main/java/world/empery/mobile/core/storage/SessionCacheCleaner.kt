/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clears Room caches tied to the signed-in account on logout (keeps UI prefs on disk).
 *
 * Invariants:
 * - Clears friends overview slices (friends, requests, circles) with chat/feed caches.
 * - Does not touch EncryptedSharedPreferences tokens or MobileUiStylePreferences.
 *
 * Related:
 * - MainViewModel.logout, MobileDatabase
 */
package world.empery.mobile.core.storage

class SessionCacheCleaner(
    private val db: MobileDatabase,
) {
    suspend fun clearSessionScopedCache() {
        db.feedDao().deleteAll()
        db.notificationDao().deleteAll()
        db.profileDao().deleteAll()
        db.chatMessageDao().deleteAll()
        db.chatDao().deleteAll()
        db.pendingSendDao().deleteAll()
        db.friendDao().deleteAll()
        db.friendRequestDao().deleteAll()
        db.friendCircleDao().deleteAll()
    }
}
