/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local Room data-source boundary for Friends SSOT (overview friends, requests, circles).
 *
 * Invariants:
 * - Repository writes go through this boundary; UI never observes Retrofit payloads directly.
 *
 * Related:
 * - FriendsDaoBundle, DefaultFriendsRepository
 */
package feature.friends.data

import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.storage.FriendEntity
import world.empery.mobile.core.storage.FriendRequestEntity
import world.empery.mobile.core.storage.FriendsDaoBundle
import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.model.FriendsOverviewSnapshot
import feature.friends.toDto
import feature.friends.toEntity

interface FriendsLocalDataSource {
    suspend fun loadOverview(): FriendsOverviewSnapshot

    suspend fun replaceOverview(
        friends: List<FriendLiteItem>,
        incomingRequests: List<FriendRequestDto>,
        sentRequests: List<FriendRequestDto>,
        circles: List<FriendCircleItemDto>,
    )

    suspend fun deleteFriend(userId: String)
}

class RoomFriendsLocalDataSource(
    private val local: FriendsDaoBundle,
) : FriendsLocalDataSource {
    override suspend fun loadOverview(): FriendsOverviewSnapshot {
        val friends =
            local.friends.getAll().map {
                FriendLiteItem(
                    id = it.id,
                    username = it.username,
                    fullName = it.fullName,
                    avatarUrl = it.avatarUrl,
                )
            }
        return FriendsOverviewSnapshot(
            friends = friends,
            incomingRequests = local.requests.getIncoming().map { it.toDto() },
            sentRequests = local.requests.getSent().map { it.toDto() },
            circles = local.circles.getAll().map { it.toDto() },
        )
    }

    override suspend fun replaceOverview(
        friends: List<FriendLiteItem>,
        incomingRequests: List<FriendRequestDto>,
        sentRequests: List<FriendRequestDto>,
        circles: List<FriendCircleItemDto>,
    ) {
        local.friends.deleteAll()
        if (friends.isNotEmpty()) {
            local.friends.upsertAll(
                friends.map {
                    FriendEntity(
                        id = it.id,
                        username = it.username,
                        fullName = it.fullName,
                        avatarUrl = it.avatarUrl,
                    )
                },
            )
        }
        local.requests.deleteAll()
        val requestEntities =
            buildList {
                addAll(incomingRequests.map { it.toEntity(FriendRequestEntity.DIRECTION_INCOMING) })
                addAll(sentRequests.map { it.toEntity(FriendRequestEntity.DIRECTION_SENT) })
            }
        if (requestEntities.isNotEmpty()) {
            local.requests.upsertAll(requestEntities)
        }
        local.circles.deleteAll()
        if (circles.isNotEmpty()) {
            local.circles.upsertAll(circles.map { it.toEntity() })
        }
    }

    override suspend fun deleteFriend(userId: String) {
        local.friends.deleteById(userId)
    }
}
