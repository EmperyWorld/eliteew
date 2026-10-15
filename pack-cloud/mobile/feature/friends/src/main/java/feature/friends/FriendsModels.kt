/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility aliases for Friends domain models plus DTO mapping helpers.
 *
 * Invariants:
 * - Public root FQNs remain source-compatible while ownership lives under domain/model.
 *
 * Related:
 * - FriendsRepository, FriendsLiteScreen
 */
package feature.friends

import world.empery.mobile.core.network.api.FriendProfileDto
import world.empery.mobile.core.network.api.FriendUserDto

typealias FriendsUiState = feature.friends.domain.model.FriendsUiState

typealias FriendsOverviewSnapshot = feature.friends.domain.model.FriendsOverviewSnapshot

typealias FriendLiteItem = feature.friends.domain.model.FriendLiteItem

enum class FriendRelationshipActionCenterState {
    BLOCKED,
    MUTED,
    PRIVACY,
    START,
    READY,
}

internal fun FriendLiteItem.relationshipActionCenterState(): FriendRelationshipActionCenterState =
    when {
        isBlocked -> FriendRelationshipActionCenterState.BLOCKED
        isMuted -> FriendRelationshipActionCenterState.MUTED
        !shareActivityWithFriend || !activityVisibleToCurrentUser -> FriendRelationshipActionCenterState.PRIVACY
        lastInteractionAt.isNullOrBlank() -> FriendRelationshipActionCenterState.START
        else -> FriendRelationshipActionCenterState.READY
    }

internal fun FriendUserDto.toFriendLiteItem(): FriendLiteItem =
    FriendLiteItem(
        id = id,
        username = username,
        fullName = full_name,
        avatarUrl = avatar_url,
        isFavorite = is_favorite,
        isMuted = is_muted,
        isBlocked = is_blocked,
        shareActivityWithFriend = share_activity_with_friend,
        activityVisibleToCurrentUser = activity_visible_to_current_user,
        lastActivityAt = last_activity_at,
        lastInteractionAt = last_interaction_at,
        circles = circles,
    )

internal fun FriendProfileDto.toFriendLiteItem(): FriendLiteItem =
    FriendLiteItem(
        id = id,
        username = username,
        fullName = full_name,
        avatarUrl = avatar_url,
        isFavorite = is_favorite,
        isMuted = is_muted,
        isBlocked = is_blocked,
        shareActivityWithFriend = share_activity_with_friend,
        activityVisibleToCurrentUser = activity_visible_to_current_user,
        lastActivityAt = last_activity_at,
        lastInteractionAt = last_interaction_at,
        circles = circles,
        privateNote = private_note,
        noteUpdatedAt = note_updated_at,
        friendshipCreatedAt = friendship_created_at,
    )
