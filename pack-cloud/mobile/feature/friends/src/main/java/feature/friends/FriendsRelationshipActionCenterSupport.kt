/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Social Hub relationship action center: KPI overview, stale contacts, inbox signals.
 *
 * Invariants:
 * - Stale-contact heuristics mirror desktop Social Hub home/inbox summaries (client-side bounded scan).
 *
 * Related:
 * - FriendsRelationshipActionCenterSection.kt, FriendsFeature.kt
 */
package feature.friends

import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

internal data class FriendsRelationshipOverviewKpi(
    val id: String,
    val count: Int,
)

internal data class FriendsRelationshipInboxSignal(
    val item: SocialHubActionInboxItemDto,
    val sortPriority: Int,
)

internal const val FRIENDS_STALE_CONTACT_INACTIVITY_DAYS = 30L
internal const val FRIENDS_STALE_CONTACT_NEVER_INTERACTED_DAYS = 7L

/** Attention contacts (non-READY) + stale contacts for hub CTA badge. */
internal fun relationshipActionCenterAttentionCount(friends: List<FriendLiteItem>): Int {
    val attention =
        friends.count { friend ->
            friend.relationshipActionCenterState() != FriendRelationshipActionCenterState.READY
        }
    val stale = detectStaleContactFriends(friends).size
    return attention + stale
}

internal fun buildFriendsRelationshipOverviewKpis(
    friends: List<FriendLiteItem>,
    incomingCount: Int,
    sentCount: Int,
): List<FriendsRelationshipOverviewKpi> {
    val favoriteCount = friends.count { it.isFavorite }
    val limitedCount = friends.count { it.isMuted || it.isBlocked }
    return listOf(
        FriendsRelationshipOverviewKpi("friends", friends.size),
        FriendsRelationshipOverviewKpi("incoming", incomingCount),
        FriendsRelationshipOverviewKpi("sent", sentCount),
        FriendsRelationshipOverviewKpi("favorites", favoriteCount),
        FriendsRelationshipOverviewKpi("limited", limitedCount),
    )
}

internal fun detectStaleContactFriends(
    friends: List<FriendLiteItem>,
    nowEpochMs: Long = System.currentTimeMillis(),
): List<FriendLiteItem> =
    friends
        .filter { friend ->
            !friend.isBlocked &&
                isStaleContactFriend(friend, nowEpochMs)
        }
        .sortedBy { friend ->
            parseIsoEpochMs(friend.lastInteractionAt ?: friend.lastActivityAt ?: friend.friendshipCreatedAt)
                ?: Long.MAX_VALUE
        }

internal fun isStaleContactFriend(
    friend: FriendLiteItem,
    nowEpochMs: Long = System.currentTimeMillis(),
): Boolean {
    if (friend.isBlocked) return false
    val lastInteractionMs = parseIsoEpochMs(friend.lastInteractionAt)
    if (lastInteractionMs != null) {
        return daysBetween(lastInteractionMs, nowEpochMs) >= FRIENDS_STALE_CONTACT_INACTIVITY_DAYS
    }
    val friendshipMs = parseIsoEpochMs(friend.friendshipCreatedAt)
    if (friendshipMs != null) {
        return daysBetween(friendshipMs, nowEpochMs) >= FRIENDS_STALE_CONTACT_NEVER_INTERACTED_DAYS
    }
    return friend.lastInteractionAt.isNullOrBlank()
}

internal fun rankInboxSignalsForActionCenter(
    inboxItems: List<SocialHubActionInboxItemDto>,
    limit: Int = 4,
): List<FriendsRelationshipInboxSignal> =
    inboxItems
        .map { item ->
            FriendsRelationshipInboxSignal(
                item = item,
                sortPriority = inboxSignalPriority(item),
            )
        }
        .sortedWith(compareBy({ it.sortPriority }, { -(it.item.count) }))
        .take(limit)

private fun inboxSignalPriority(item: SocialHubActionInboxItemDto): Int =
    when (item.type) {
        "incoming_requests" -> 0
        "stale_sent_requests" -> 1
        "privacy_review" -> 2
        "relationship_controls" -> 3
        "empty_circles" -> 4
        else ->
            when (item.severity) {
                "high" -> 5
                "medium" -> 6
                else -> 7
            }
    }

internal fun parseIsoEpochMs(value: String?): Long? {
    val trimmed = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return runCatching {
        OffsetDateTime.parse(trimmed).toInstant().toEpochMilli()
    }.getOrNull()
}

private fun daysBetween(
    fromEpochMs: Long,
    toEpochMs: Long,
): Long = ChronoUnit.DAYS.between(
    java.time.Instant.ofEpochMilli(fromEpochMs).atZone(java.time.ZoneOffset.UTC).toLocalDate(),
    java.time.Instant.ofEpochMilli(toEpochMs).atZone(java.time.ZoneOffset.UTC).toLocalDate(),
)
