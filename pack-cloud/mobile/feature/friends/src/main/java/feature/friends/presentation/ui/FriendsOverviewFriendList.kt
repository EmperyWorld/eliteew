/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy-list status cards, circle filters, and friend rows for Friends overview.
 *
 * Invariants:
 * - Focused friend ordering is deterministic.
 * - A mutation disables conflicting friend-card actions.
 *
 * Related:
 * - FriendsOverviewContent.kt
 * - FriendsFriendCard.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumStateCard

internal fun LazyListScope.friendsStatusAndListItems(
    state: FriendsUiState,
    refreshBusy: Boolean,
    showRefreshError: Boolean,
    onDismissRefreshError: () -> Unit,
    onRetryRefresh: () -> Unit,
    showActionError: Boolean,
    onDismissActionError: () -> Unit,
    selectedCircleId: String?,
    onSelectedCircleChange: (String?) -> Unit,
    onOpenFriendDetail: (FriendLiteItem) -> Unit,
    onToggleFavorite: (FriendLiteItem) -> Unit,
    onToggleMute: (FriendLiteItem) -> Unit,
    onToggleShareActivity: (FriendLiteItem) -> Unit,
    onRequestBlockToggle: (FriendLiteItem) -> Unit,
    onPendingBlock: (FriendLiteItem) -> Unit,
    onPendingReport: (FriendLiteItem) -> Unit,
) {
    if (refreshBusy) {
        item {
            val progressCd = stringResource(R.string.friends_loading_progress_cd)
            LinearProgressIndicator(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics { contentDescription = progressCd },
            )
        }
    }

    if (showRefreshError) {
        item {
            val errorText = state.error.orEmpty()
            val errCd = stringResource(R.string.friends_refresh_error_cd, errorText)
            val dismissCd = stringResource(R.string.friends_error_dismiss_refresh_cd)
            val retryCd = stringResource(R.string.friends_error_retry_cd)
            PremiumStateCard(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics {
                            liveRegion = LiveRegionMode.Polite
                            contentDescription = errCd
                        },
                title = stringResource(R.string.friends_section_my_friends),
                message = stringResource(R.string.friends_refresh_error_message, errorText),
                isError = true,
                action = {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(
                            onClick = onRetryRefresh,
                            modifier = Modifier.semantics { contentDescription = retryCd },
                        ) {
                            Text(stringResource(R.string.friends_error_retry))
                        }
                        TextButton(
                            onClick = onDismissRefreshError,
                            modifier = Modifier.semantics { contentDescription = dismissCd },
                        ) {
                            Text(stringResource(R.string.friends_error_dismiss))
                        }
                    }
                },
            )
        }
    }

    if (showActionError) {
        item {
            val errorText = state.actionError.orEmpty()
            val errCd = stringResource(R.string.friends_action_error_cd, errorText)
            val dismissCd = stringResource(R.string.friends_error_dismiss_action_cd)
            PremiumStateCard(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics {
                            liveRegion = LiveRegionMode.Polite
                            contentDescription = errCd
                        },
                title = stringResource(R.string.friends_section_incoming),
                message = stringResource(R.string.friends_action_error_message, errorText),
                isError = true,
                action = {
                    TextButton(
                        onClick = onDismissActionError,
                        modifier = Modifier.semantics { contentDescription = dismissCd },
                    ) {
                        Text(stringResource(R.string.friends_error_dismiss))
                    }
                },
            )
        }
    }

    if (state.circles.isNotEmpty()) {
        item {
            CircleSelector(
                circles = state.circles,
                selectedCircleId = selectedCircleId,
                onSelectedCircleChange = onSelectedCircleChange,
                modifier = Modifier.animateItem(),
            )
        }
    }

    val selectedCircle =
        selectedCircleId?.let { id -> state.circles.firstOrNull { it.id == id } }
    val visibleFriends =
        selectedCircleId?.let { id ->
            state.friends.filter { friend -> friend.circles.any { it.id == id } }
        } ?: state.friends
    val focusedFriends =
        state.focusedFriendUserId?.let { focusedId ->
            visibleFriends.sortedWith(
                compareByDescending<FriendLiteItem> { it.id == focusedId }
                    .thenBy { it.fullName ?: it.username ?: it.id },
            )
        } ?: visibleFriends

    item {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FriendsSectionTitle(text = stringResource(R.string.friends_section_my_friends))
            if (visibleFriends.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
                ) {
                    Text(
                        text = visibleFriends.size.toString(),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
        }
    }

    when {
        refreshBusy && visibleFriends.isEmpty() -> {
            item {
                FriendsLoadingBlock(
                    message = stringResource(R.string.friends_loading_list),
                    loadingSemantics = stringResource(R.string.friends_loading_list),
                )
            }
        }
        visibleFriends.isEmpty() -> {
            item {
                FriendsEmptyHint(
                    title = selectedCircle?.name ?: stringResource(R.string.friends_empty_title),
                    message =
                        selectedCircle?.let {
                            stringResource(R.string.friends_circle_filter_empty, it.name)
                        } ?: stringResource(R.string.friends_empty_subtitle),
                    emptySemantics =
                        selectedCircle?.let {
                            stringResource(R.string.friends_circle_filter_empty, it.name)
                        } ?: "${stringResource(R.string.friends_empty_title)}. " +
                            stringResource(R.string.friends_empty_subtitle),
                )
            }
        }
        else -> {
            items(
                items = focusedFriends,
                key = { it.id },
                contentType = { LazyContentTypeFriend },
            ) { friend ->
                val displayName = friend.fullName ?: friend.username ?: friend.id
                val circleSummary =
                    friend.circles
                        .map { it.name }
                        .filter { it.isNotBlank() }
                        .joinToString(", ")
                        .takeIf { it.isNotBlank() }
                val baseRowCd =
                    friend.username?.takeIf { it.isNotBlank() }?.let {
                        stringResource(R.string.friends_friend_row_cd, displayName, it)
                    } ?: stringResource(R.string.friends_friend_row_cd_short, displayName)
                val rowCd =
                    circleSummary?.let {
                        stringResource(R.string.friends_friend_row_circles_cd, baseRowCd, it)
                    } ?: baseRowCd
                val rowBusy = state.inFlightRequestId == friend.id
                val actionsEnabled = !refreshBusy && (state.inFlightRequestId == null || rowBusy)
                FriendItem(
                    friend = friend,
                    isFocused = state.focusedFriendUserId == friend.id,
                    rowBusy = rowBusy,
                    actionsEnabled = actionsEnabled,
                    rowSemantics = rowCd,
                    modifier = Modifier.animateItem(),
                    onOpenDetail = { onOpenFriendDetail(friend) },
                    onToggleFavorite = { onToggleFavorite(friend) },
                    onToggleMute = { onToggleMute(friend) },
                    onToggleShareActivity = { onToggleShareActivity(friend) },
                    onBlockClick = {
                        if (friend.isBlocked) {
                            onRequestBlockToggle(friend)
                        } else {
                            onPendingBlock(friend)
                        }
                    },
                    onReportClick = { onPendingReport(friend) },
                )
            }
        }
    }
}
