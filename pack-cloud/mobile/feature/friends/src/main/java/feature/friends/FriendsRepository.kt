/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility alias for the Friends data implementation.
 *
 * Invariants:
 * - New composition code imports DefaultFriendsRepository directly.
 * - Existing source imports keep the root FriendsRepository FQN.
 *
 * Related:
 * - data/DefaultFriendsRepository.kt
 * - domain/FriendsRepository.kt
 */
package feature.friends

typealias FriendsRepository = feature.friends.data.DefaultFriendsRepository
