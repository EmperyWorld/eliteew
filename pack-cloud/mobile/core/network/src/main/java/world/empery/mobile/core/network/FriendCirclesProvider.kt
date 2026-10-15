/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Minimal cross-feature read boundary for privacy circle choices.
 *
 * Invariants:
 * - Returns the existing network DTO without exposing Friends repository ownership.
 *
 * Related:
 * - feature.friends.data.DefaultFriendsRepository
 * - feature.profile.ProfileRepository
 */
package world.empery.mobile.core.network

import world.empery.mobile.core.network.api.FriendCircleItemDto

fun interface FriendCirclesProvider {
    suspend fun loadFriendCircles(): List<FriendCircleItemDto>
}
