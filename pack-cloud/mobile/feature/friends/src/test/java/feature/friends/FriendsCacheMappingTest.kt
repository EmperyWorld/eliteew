/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Room entity ↔ overview DTO mapping tests for friends offline cache (T13).
 */
package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.storage.FriendRequestEntity

class FriendsCacheMappingTest {
    @Test
    fun friendRequestRoundTripPreservesIncomingDirection() {
        val dto =
            FriendRequestDto(
                id = "req-in-1",
                from_user_id = "user-a",
                to_user_id = "user-b",
                username = "alice",
                full_name = "Alice",
                avatar_url = "https://cdn.example/a.png",
                created_at = "2026-06-30T12:00:00Z",
            )
        val entity = dto.toEntity(FriendRequestEntity.DIRECTION_INCOMING)
        assertEquals(FriendRequestEntity.DIRECTION_INCOMING, entity.direction)
        assertEquals(dto, entity.toDto())
    }

    @Test
    fun friendRequestRoundTripPreservesSentDirection() {
        val dto =
            FriendRequestDto(
                id = "req-out-1",
                to_user_id = "user-c",
                username = "bob",
                created_at = "2026-06-29T08:00:00Z",
            )
        val entity = dto.toEntity(FriendRequestEntity.DIRECTION_SENT)
        assertEquals(FriendRequestEntity.DIRECTION_SENT, entity.direction)
        assertEquals(dto, entity.toDto())
    }

    @Test
    fun friendCircleRoundTripPreservesSortAndCounts() {
        val dto =
            FriendCircleItemDto(
                id = "circle-1",
                name = "Close",
                members_count = 3,
                sort_order = 2,
                color = "#aabbcc",
                icon = "group",
            )
        assertEquals(dto, dto.toEntity().toDto())
    }
}
