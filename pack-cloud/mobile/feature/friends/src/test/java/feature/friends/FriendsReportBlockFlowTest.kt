package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** security-005/006 + friends-009: report preset ids and block chip ordering. */
class FriendsReportBlockFlowTest {
    @Test
    fun reportPresetsStableIds() {
        assertEquals("spam", FriendReportPreset.SPAM.id)
        assertEquals("other", FriendReportPreset.OTHER.id)
    }

    @Test
    fun blockedFriendShowsBlockedChipFirst() {
        val friend =
            FriendLiteItem(
                id = "u1",
                username = "alice",
                fullName = "Alice",
                avatarUrl = null,
                isBlocked = true,
                isFavorite = true,
                isMuted = false,
                shareActivityWithFriend = false,
                activityVisibleToCurrentUser = false,
            )
        val chips = friend.relationshipChips()
        assertTrue(chips.first() == FriendRelationshipChip.BLOCKED)
    }
}
