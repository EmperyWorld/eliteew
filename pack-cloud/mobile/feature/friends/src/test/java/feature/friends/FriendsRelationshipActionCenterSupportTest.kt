package feature.friends

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import java.time.OffsetDateTime

class FriendsRelationshipActionCenterSupportTest {
    @Test
    fun overviewKpisIncludeIncomingAndLimitedCounts() {
        val friends =
            listOf(
                FriendLiteItem(
                    id = "f1",
                    username = "a",
                    fullName = "A",
                    avatarUrl = null,
                    isFavorite = true,
                    isMuted = true,
                ),
                FriendLiteItem(
                    id = "f2",
                    username = "b",
                    fullName = "B",
                    avatarUrl = null,
                    isBlocked = true,
                ),
            )
        val kpis = buildFriendsRelationshipOverviewKpis(friends, incomingCount = 2, sentCount = 1)
        assertEquals(2, kpis.first { it.id == "friends" }.count)
        assertEquals(2, kpis.first { it.id == "incoming" }.count)
        assertEquals(1, kpis.first { it.id == "sent" }.count)
        assertEquals(1, kpis.first { it.id == "favorites" }.count)
        assertEquals(2, kpis.first { it.id == "limited" }.count)
    }

    @Test
    fun attentionCountCountsNonReadyAndStale() {
        val friends =
            listOf(
                FriendLiteItem(
                    id = "muted",
                    username = "m",
                    fullName = "Muted",
                    avatarUrl = null,
                    isMuted = true,
                    lastInteractionAt = "2026-07-15T12:00:00Z",
                ),
                FriendLiteItem(
                    id = "stale",
                    username = "s",
                    fullName = "Stale",
                    avatarUrl = null,
                    lastInteractionAt = "2026-01-01T12:00:00Z",
                ),
            )
        assertTrue(relationshipActionCenterAttentionCount(friends) >= 2)
        assertTrue(relationshipActionCenterHasSignals(friends, emptyList()))
        assertFalse(relationshipActionCenterHasSignals(emptyList(), emptyList()))
    }

    @Test
    fun staleContactDetectsOldInteractionAndNeverContactedFriends() {
        val now = OffsetDateTime.parse("2026-06-30T12:00:00Z").toInstant().toEpochMilli()
        val oldInteraction = OffsetDateTime.parse("2026-05-01T12:00:00Z").toString()
        val recentFriendship = OffsetDateTime.parse("2026-06-29T12:00:00Z").toString()
        val oldFriendship = OffsetDateTime.parse("2026-06-01T12:00:00Z").toString()

        val staleByInteraction =
            FriendLiteItem(
                id = "old",
                username = "old",
                fullName = "Old",
                avatarUrl = null,
                lastInteractionAt = oldInteraction,
            )
        val staleNeverTalked =
            FriendLiteItem(
                id = "new",
                username = "new",
                fullName = "New",
                avatarUrl = null,
                friendshipCreatedAt = oldFriendship,
            )
        val fresh =
            FriendLiteItem(
                id = "fresh",
                username = "fresh",
                fullName = "Fresh",
                avatarUrl = null,
                lastInteractionAt = OffsetDateTime.parse("2026-06-29T12:00:00Z").toString(),
                friendshipCreatedAt = recentFriendship,
            )

        assertTrue(isStaleContactFriend(staleByInteraction, now))
        assertTrue(isStaleContactFriend(staleNeverTalked, now))
        assertFalse(isStaleContactFriend(fresh, now))
        assertFalse(isStaleContactFriend(staleByInteraction.copy(isBlocked = true), now))
    }

    @Test
    fun inboxSignalsPreferIncomingBeforeStaleSent() {
        val items =
            listOf(
                SocialHubActionInboxItemDto(
                    id = "stale_sent_requests",
                    type = "stale_sent_requests",
                    severity = "medium",
                    title = "Stale",
                    summary = "Stale summary",
                    count = 2,
                ),
                SocialHubActionInboxItemDto(
                    id = "incoming_requests",
                    type = "incoming_requests",
                    severity = "high",
                    title = "Incoming",
                    summary = "Incoming summary",
                    count = 1,
                ),
            )
        val ranked = rankInboxSignalsForActionCenter(items)
        assertEquals("incoming_requests", ranked.first().item.id)
    }
}

class FriendDetailTimelineSupportTest {
    @Test
    fun timelineEntriesIncludeFriendshipAndInteraction() {
        val friend =
            FriendLiteItem(
                id = "f1",
                username = "friend",
                fullName = "Friend",
                avatarUrl = null,
                friendshipCreatedAt = "2026-01-15T10:00:00Z",
                lastInteractionAt = "2026-06-20T10:00:00Z",
            )
        val entries = buildFriendTimelineEntries(friend)
        assertEquals(2, entries.size)
        assertEquals("friendship", entries.first().id)
        assertEquals("interaction", entries.last().id)
    }

    @Test
    fun sharedContentDisplayTitlePrefersTitleThenName() {
        val item =
            SocialHubSharedContentItemDto(
                id = "c1",
                title = "Track mix",
                name = "mix.wav",
                direction = "from_friend",
                shared_reason = "gaf_attachment",
                created_at = "2026-06-01T00:00:00Z",
                updated_at = "2026-06-01T00:00:00Z",
            )
        assertEquals("Track mix", sharedContentDisplayTitle(item))
    }

    @Test
    fun timelineEntriesEmptyWhenFriendHasNoTimestamps() {
        val friend =
            FriendLiteItem(
                id = "f1",
                username = "friend",
                fullName = "Friend",
                avatarUrl = null,
            )
        assertTrue(buildFriendTimelineEntries(friend).isEmpty())
    }

    @Test
    fun sharedContentPhaseLoadingIgnoresEmptyItemsAndFakeZeroCounts() {
        assertEquals(
            FriendSharedContentPhase.Loading,
            resolveFriendSharedContentPhase(
                items = emptyList(),
                isLoading = true,
                errorMessage = null,
            ),
        )
    }

    @Test
    fun sharedContentPhaseEmptyAfterSuccessfulLoad() {
        assertEquals(
            FriendSharedContentPhase.Empty,
            resolveFriendSharedContentPhase(
                items = emptyList(),
                isLoading = false,
                errorMessage = null,
            ),
        )
    }

    @Test
    fun sharedContentPhaseReadyCountsDirections() {
        val phase =
            resolveFriendSharedContentPhase(
                items =
                    listOf(
                        SocialHubSharedContentItemDto(
                            id = "a",
                            title = "A",
                            name = null,
                            direction = "from_friend",
                            shared_reason = "manual",
                            created_at = "2026-06-01T00:00:00Z",
                            updated_at = "2026-06-01T00:00:00Z",
                        ),
                        SocialHubSharedContentItemDto(
                            id = "b",
                            title = "B",
                            name = null,
                            direction = "to_friend",
                            shared_reason = "manual",
                            created_at = "2026-06-01T00:00:00Z",
                            updated_at = "2026-06-01T00:00:00Z",
                        ),
                        SocialHubSharedContentItemDto(
                            id = "c",
                            title = "C",
                            name = null,
                            direction = "to_friend",
                            shared_reason = "manual",
                            created_at = "2026-06-01T00:00:00Z",
                            updated_at = "2026-06-01T00:00:00Z",
                        ),
                    ),
                isLoading = false,
                errorMessage = null,
            )
        val ready = phase as FriendSharedContentPhase.Ready
        assertEquals(1, ready.fromFriendCount)
        assertEquals(2, ready.toFriendCount)
        assertEquals(3, ready.items.size)
    }

    @Test
    fun sharedContentPhaseErrorWinsOverItems() {
        val phase =
            resolveFriendSharedContentPhase(
                items =
                    listOf(
                        SocialHubSharedContentItemDto(
                            id = "a",
                            title = "A",
                            name = null,
                            direction = "from_friend",
                            shared_reason = "manual",
                            created_at = "2026-06-01T00:00:00Z",
                            updated_at = "2026-06-01T00:00:00Z",
                        ),
                    ),
                isLoading = false,
                errorMessage = "timeout",
            )
        assertEquals(FriendSharedContentPhase.Error("timeout"), phase)
    }
}
