/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JVM tests for friends tab offline refresh UI hydration (T01b).
 */
package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendRequestDto

class FriendsOfflineRefreshSupportTest {
    @Test
    fun applyOverviewCache_hydratesAllFourSnapshotFields() {
        val snapshot =
            FriendsOverviewSnapshot(
                friends = listOf(FriendLiteItem("f1", "alice", "Alice", null)),
                incomingRequests =
                    listOf(
                        FriendRequestDto(
                            id = "req-in",
                            from_user_id = "u2",
                            username = "bob",
                            created_at = "2026-06-30T10:00:00Z",
                        ),
                    ),
                sentRequests =
                    listOf(
                        FriendRequestDto(
                            id = "req-out",
                            to_user_id = "u3",
                            username = "carol",
                            created_at = "2026-06-29T10:00:00Z",
                        ),
                    ),
                circles =
                    listOf(
                        FriendCircleItemDto(
                            id = "c1",
                            name = "Close",
                            members_count = 2,
                            sort_order = 0,
                        ),
                    ),
            )
        val result =
            applyFriendsOverviewCacheToUiState(
                FriendsUiState(isLoading = true, isReferralLoading = true),
                snapshot,
                errorMessage = "network down",
            )
        assertEquals(snapshot.friends, result.friends)
        assertEquals(snapshot.incomingRequests, result.incomingRequests)
        assertEquals(snapshot.sentRequests, result.sentRequests)
        assertEquals(snapshot.circles, result.circles)
        assertFalse(result.isLoading)
        assertFalse(result.isReferralLoading)
        assertEquals("network down", result.error)
    }
}
