/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends UI helpers and compatibility delegates for domain-owned deep-link focus.
 *
 * Invariants:
 * - Report presets are stable ids mapped to localized labels in UI layer.
 *
 * Related:
 * - domain/usecase/FriendsDeepLinkUseCase.kt
 * - presentation/FriendsTabViewModel.kt
 */
package feature.friends

import feature.friends.domain.usecase.toFriendsFocusTarget
import world.empery.mobile.core.network.api.FriendRequestDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto

/** friends-010: relationship state chips for list/detail surfaces. */
enum class FriendRelationshipChip {
    FRIEND,
    REQUEST_PENDING,
    MUTED,
    BLOCKED,
    FAVORITE,
    ACTIVITY_SHARED,
    ACTIVITY_HIDDEN,
}

internal fun FriendLiteItem.relationshipChips(): List<FriendRelationshipChip> {
    val chips = mutableListOf<FriendRelationshipChip>()
    if (isBlocked) chips += FriendRelationshipChip.BLOCKED
    else {
        chips += FriendRelationshipChip.FRIEND
        if (isFavorite) chips += FriendRelationshipChip.FAVORITE
        if (isMuted) chips += FriendRelationshipChip.MUTED
        if (shareActivityWithFriend && activityVisibleToCurrentUser) {
            chips += FriendRelationshipChip.ACTIVITY_SHARED
        } else {
            chips += FriendRelationshipChip.ACTIVITY_HIDDEN
        }
    }
    return chips
}

internal fun FriendRequestDto.isExpiredSentRequest(nowEpochMs: Long = System.currentTimeMillis()): Boolean {
    val created = created_at?.trim()?.takeIf { it.isNotEmpty() } ?: return false
    val epoch =
        runCatching {
            java.time.OffsetDateTime.parse(created).toInstant().toEpochMilli()
        }.getOrNull() ?: return false
    val thirtyDaysMs = 30L * 24L * 60L * 60L * 1000L
    return nowEpochMs - epoch > thirtyDaysMs
}

/** friends-009: stable report reason preset ids. */
enum class FriendReportPreset(val id: String) {
    SPAM("spam"),
    HARASSMENT("harassment"),
    IMPERSONATION("impersonation"),
    INAPPROPRIATE("inappropriate"),
    OTHER("other"),
}

internal fun FriendReportPreset.defaultReasonLabelRes(): Int =
    when (this) {
        FriendReportPreset.SPAM -> R.string.friends_report_preset_spam
        FriendReportPreset.HARASSMENT -> R.string.friends_report_preset_harassment
        FriendReportPreset.IMPERSONATION -> R.string.friends_report_preset_impersonation
        FriendReportPreset.INAPPROPRIATE -> R.string.friends_report_preset_inappropriate
        FriendReportPreset.OTHER -> R.string.friends_report_preset_other
    }

typealias FriendsPushFocusTarget = feature.friends.domain.usecase.FriendsPushFocusTarget

fun resolveFriendsPushFocus(
    focus: String?,
    friendRequestId: String?,
    friendUserId: String?,
    inboxItemId: String?,
): FriendsPushFocusTarget =
    feature.friends.domain.usecase.resolveFriendsPushFocusTarget(
        focus = focus,
        friendRequestId = friendRequestId,
        friendUserId = friendUserId,
        inboxItemId = inboxItemId,
    )

/** Maps shell focus + parsed push target to Friends deeplink mode. */
fun resolveFriendsDeepLinkFocus(
    focus: String?,
    pushFocus: FriendsPushFocusTarget,
): String? = feature.friends.domain.usecase.resolveFriendsFocusMode(focus, pushFocus)

internal fun sortFriendsForPushFocus(
    friends: List<FriendLiteItem>,
    focusedFriendUserId: String?,
): List<FriendLiteItem> {
    val id = focusedFriendUserId?.trim()?.takeIf { it.isNotEmpty() } ?: return friends
    return friends.sortedWith(
        compareByDescending<FriendLiteItem> { it.id == id }
            .thenBy { it.fullName ?: it.username ?: it.id },
    )
}

internal fun sortIncomingForPushFocus(
    requests: List<FriendRequestDto>,
    focusedRequestId: String?,
): List<FriendRequestDto> {
    val id = focusedRequestId?.trim()?.takeIf { it.isNotEmpty() } ?: return requests
    return requests.sortedWith(
        compareByDescending<FriendRequestDto> { it.id == id }
            .thenBy { it.full_name ?: it.username ?: it.id },
    )
}

fun SocialHubActionInboxItemDto.targetFocus(): FriendsPushFocusTarget? {
    return toFriendsFocusTarget()
}
