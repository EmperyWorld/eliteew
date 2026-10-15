/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dedicated nested Friends screen for Social Hub relationship action center
 * (desktop-lite IA: focused surface with honest loading/error/empty).
 *
 * Invariants:
 * - Reuses [FriendsRelationshipActionCenterSection] for content body.
 * - Loading/error/empty are premium shared states — no blank scaffold.
 *
 * Related:
 * - FriendsRelationshipActionCenterSection.kt, TabHostNavGraph (friends/action-center)
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.ui.MobileEmptyState
import world.empery.mobile.core.ui.MobileErrorState
import world.empery.mobile.core.ui.MobileLoadingSkeleton
import world.empery.mobile.core.ui.MobileLoadingSkeletonVariant

@Composable
fun FriendsRelationshipActionCenterScreen(
    state: FriendsUiState,
    socialHubInbox: List<SocialHubActionInboxItemDto>,
    onOpenFriend: (FriendLiteItem) -> Unit,
    onOpenInbox: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onInboxItemClick: (SocialHubActionInboxItemDto) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val hasSignals = relationshipActionCenterHasSignals(state.friends, socialHubInbox)
    val coldStart = state.friends.isEmpty() && socialHubInbox.isEmpty()

    when {
        state.isLoading && coldStart -> {
            MobileLoadingSkeleton(
                message = stringResource(R.string.friends_action_center_loading),
                modifier = modifier.fillMaxSize().padding(16.dp),
                variant = MobileLoadingSkeletonVariant.CARD,
            )
        }
        state.error != null && coldStart -> {
            MobileErrorState(
                title = stringResource(R.string.friends_relationship_action_center_title),
                message = state.error ?: stringResource(R.string.friends_action_center_error_body),
                retryLabel = stringResource(R.string.friends_action_center_retry),
                onRetry = onRetry,
                modifier = modifier.fillMaxSize(),
            )
        }
        !state.isLoading && !hasSignals && coldStart -> {
            MobileEmptyState(
                title = stringResource(R.string.friends_relationship_action_center_title),
                message = stringResource(R.string.friends_relationship_action_center_all_clear),
                icon = Icons.Outlined.Hub,
                modifier = modifier.fillMaxSize(),
            )
        }
        else -> {
            Column(
                modifier =
                    modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                FriendsRelationshipActionCenterSection(
                    friends = state.friends,
                    incomingCount = state.incomingRequests.size,
                    sentCount = state.sentRequests.size,
                    inboxItems = socialHubInbox,
                    onOpenFriend = onOpenFriend,
                    onOpenInbox = onOpenInbox,
                    onOpenPrivacy = onOpenPrivacy,
                    onInboxItemClick = onInboxItemClick,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

internal fun relationshipActionCenterHasSignals(
    friends: List<FriendLiteItem>,
    inboxItems: List<SocialHubActionInboxItemDto>,
): Boolean {
    val attention =
        friends.any { friend ->
            friend.relationshipActionCenterState() != FriendRelationshipActionCenterState.READY
        }
    val stale = detectStaleContactFriends(friends).isNotEmpty()
    val inboxSignals = rankInboxSignalsForActionCenter(inboxItems).isNotEmpty()
    return attention || stale || inboxSignals || friends.isNotEmpty()
}
