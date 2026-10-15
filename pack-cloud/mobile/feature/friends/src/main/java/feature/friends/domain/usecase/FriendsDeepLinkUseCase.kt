/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve Friends deep-link precedence and load the overview context needed for focus.
 *
 * Invariants:
 * - Request focus wins over friend detail, which wins over Social Hub fallback.
 * - Optional inbox/privacy failures are observable to the presentation error reporter.
 *
 * Related:
 * - feature.friends.presentation.FriendsTabViewModel
 * - FriendsRoadmapSupport.kt compatibility functions
 */
package feature.friends.domain.usecase

import feature.friends.domain.FriendsRepository
import feature.friends.domain.model.FriendsOverviewSnapshot
import kotlinx.coroutines.CancellationException
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto

data class FriendsPushFocusTarget(
    val requestId: String? = null,
    val friendUserId: String? = null,
    val socialHubInboxItemId: String? = null,
)

data class FriendsDeepLinkInput(
    val friendRequestId: String?,
    val friendUserId: String?,
    val focus: String?,
    val socialHubInboxItemId: String?,
)

data class FriendsDeepLinkResult(
    val overview: FriendsOverviewSnapshot,
    val inbox: List<SocialHubActionInboxItemDto>,
    val privacyPreview: SocialHubPrivacyPreviewResponseDto?,
    val focus: String,
    val requestId: String?,
    val friendUserId: String?,
    val socialHubInboxItemId: String?,
    val inboxFailure: Throwable?,
    val privacyFailure: Throwable?,
)

class FriendsDeepLinkUseCase(
    private val repository: FriendsRepository,
) {
    suspend operator fun invoke(input: FriendsDeepLinkInput): FriendsDeepLinkResult? {
        val pushFocus =
            resolveFriendsPushFocusTarget(
                focus = input.focus,
                friendRequestId = input.friendRequestId,
                friendUserId = input.friendUserId,
                inboxItemId = input.socialHubInboxItemId,
            )
        val normalizedFocus = resolveFriendsFocusMode(input.focus, pushFocus) ?: return null
        val overview = repository.refreshOverview()
        val inboxResult = captureOptional { repository.loadSocialHubInbox() }
        val privacyResult = captureOptional { repository.loadPrivacyPreview() }
        val inbox = inboxResult.getOrNull().orEmpty()
        val inboxDerived =
            pushFocus.socialHubInboxItemId
                ?.let { id -> inbox.firstOrNull { item -> item.id == id } }
                ?.toFriendsFocusTarget()
        val effectiveRequestId = pushFocus.requestId ?: inboxDerived?.requestId
        val effectiveFriendUserId =
            if (effectiveRequestId == null) {
                pushFocus.friendUserId ?: inboxDerived?.friendUserId
            } else {
                null
            }
        val effectiveFocus =
            when {
                effectiveRequestId != null -> "request"
                effectiveFriendUserId != null -> "friend_detail"
                else -> normalizedFocus
            }
        return FriendsDeepLinkResult(
            overview = overview,
            inbox = inbox,
            privacyPreview = privacyResult.getOrNull(),
            focus = effectiveFocus,
            requestId = effectiveRequestId,
            friendUserId = effectiveFriendUserId,
            socialHubInboxItemId = pushFocus.socialHubInboxItemId,
            inboxFailure = inboxResult.exceptionOrNull(),
            privacyFailure = privacyResult.exceptionOrNull(),
        )
    }
}

fun resolveFriendsPushFocusTarget(
    focus: String?,
    friendRequestId: String?,
    friendUserId: String?,
    inboxItemId: String?,
): FriendsPushFocusTarget {
    val normalized = focus?.trim()?.lowercase()
    return when (normalized) {
        "request", "friend_request" ->
            FriendsPushFocusTarget(requestId = friendRequestId.normalizedId())
        "friend_detail", "friend" ->
            FriendsPushFocusTarget(friendUserId = friendUserId.normalizedId())
        "social_hub", "inbox" ->
            FriendsPushFocusTarget(socialHubInboxItemId = inboxItemId.normalizedId())
        else ->
            FriendsPushFocusTarget(
                requestId = friendRequestId.normalizedId(),
                friendUserId = friendUserId.normalizedId(),
                socialHubInboxItemId = inboxItemId.normalizedId(),
            )
    }
}

fun resolveFriendsFocusMode(
    focus: String?,
    pushFocus: FriendsPushFocusTarget,
): String? =
    when {
        pushFocus.requestId != null -> "request"
        pushFocus.friendUserId != null -> "friend_detail"
        focus?.trim()?.lowercase() in setOf("incoming", "inbox") -> "incoming"
        focus?.trim()?.lowercase() == "social_hub" || pushFocus.socialHubInboxItemId != null -> "social_hub"
        else -> null
    }

fun SocialHubActionInboxItemDto.toFriendsFocusTarget(): FriendsPushFocusTarget? {
    val tab = target_tab?.trim()?.lowercase().orEmpty()
    val targetId = target_id.normalizedId() ?: return null
    return when {
        tab.contains("friend") && type.contains("request", ignoreCase = true) ->
            FriendsPushFocusTarget(requestId = targetId)
        tab.contains("friend") ->
            FriendsPushFocusTarget(friendUserId = targetId)
        else -> FriendsPushFocusTarget(socialHubInboxItemId = id)
    }
}

private suspend fun <T> captureOptional(block: suspend () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (error: Throwable) {
        if (error is CancellationException) throw error
        Result.failure(error)
    }

private fun String?.normalizedId(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
