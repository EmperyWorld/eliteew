/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map friends overview DTOs to Room entities for offline request/circle cache (T13).
 *
 * Invariants:
 * - Request direction uses [FriendRequestEntity] constants only.
 *
 * Related:
 * - FriendsRepository, MobileDatabase friend_request_rows / friend_circle_rows
 */
package feature.friends

import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.storage.FriendCircleEntity
import world.empery.mobile.core.storage.FriendRequestEntity

internal fun FriendRequestDto.toEntity(direction: String): FriendRequestEntity =
    FriendRequestEntity(
        id = id,
        direction = direction,
        fromUserId = from_user_id,
        toUserId = to_user_id,
        username = username,
        fullName = full_name,
        avatarUrl = avatar_url,
        createdAt = created_at,
    )

internal fun FriendRequestEntity.toDto(): FriendRequestDto =
    FriendRequestDto(
        id = id,
        from_user_id = fromUserId,
        to_user_id = toUserId,
        username = username,
        full_name = fullName,
        avatar_url = avatarUrl,
        created_at = createdAt,
    )

internal fun FriendCircleItemDto.toEntity(): FriendCircleEntity =
    FriendCircleEntity(
        id = id,
        name = name,
        membersCount = members_count,
        sortOrder = sort_order,
        color = color,
        icon = icon,
    )

internal fun FriendCircleEntity.toDto(): FriendCircleItemDto =
    FriendCircleItemDto(
        id = id,
        name = name,
        members_count = membersCount,
        sort_order = sortOrder,
        color = color,
        icon = icon,
    )
