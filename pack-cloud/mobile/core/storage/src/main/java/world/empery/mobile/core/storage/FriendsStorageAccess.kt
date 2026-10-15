/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Core-storage composition boundary for Friends Room DAOs.
 *
 * Invariants:
 * - Feature and app modules do not invoke MobileDatabase members directly for Friends wiring.
 *
 * Related:
 * - MobileDatabase.kt
 * - feature.friends.data.DefaultFriendsRepository
 */
package world.empery.mobile.core.storage

data class FriendsDaoBundle(
    val friends: FriendDao,
    val requests: FriendRequestDao,
    val circles: FriendCircleDao,
)

fun friendsDaoBundle(database: MobileDatabase): FriendsDaoBundle =
    FriendsDaoBundle(
        friends = database.friendDao(),
        requests = database.friendRequestDao(),
        circles = database.friendCircleDao(),
    )
