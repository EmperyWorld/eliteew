/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Named DDD presentation components for Friends (list, item, search, circles, detail).
 * Thin facades over existing Compose implementations — no behavior fork.
 *
 * Invariants:
 * - Public names match the Friends DDD contract; internals stay in feature.friends.
 *
 * Related:
 * - FriendsOverviewFriendList.kt, FriendsFriendCard.kt, FriendDetailScreen.kt, FriendsFeature.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.FriendSearchCandidateDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import world.empery.mobile.core.ui.ScaledOutlinedButton

/** Overview LazyColumn rows: status, circle filters, friend cards. */
fun LazyListScope.FriendList(
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
) = friendsStatusAndListItems(
    state = state,
    refreshBusy = refreshBusy,
    showRefreshError = showRefreshError,
    onDismissRefreshError = onDismissRefreshError,
    onRetryRefresh = onRetryRefresh,
    showActionError = showActionError,
    onDismissActionError = onDismissActionError,
    selectedCircleId = selectedCircleId,
    onSelectedCircleChange = onSelectedCircleChange,
    onOpenFriendDetail = onOpenFriendDetail,
    onToggleFavorite = onToggleFavorite,
    onToggleMute = onToggleMute,
    onToggleShareActivity = onToggleShareActivity,
    onRequestBlockToggle = onRequestBlockToggle,
    onPendingBlock = onPendingBlock,
    onPendingReport = onPendingReport,
)

/** Single friend row card. */
@Composable
fun FriendItem(
    friend: FriendLiteItem,
    isFocused: Boolean,
    rowBusy: Boolean,
    actionsEnabled: Boolean,
    rowSemantics: String,
    onOpenDetail: () -> Unit,
    onToggleFavorite: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleShareActivity: () -> Unit,
    onBlockClick: () -> Unit,
    onReportClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FriendsFriendCard(
        friend = friend,
        isFocused = isFocused,
        rowBusy = rowBusy,
        actionsEnabled = actionsEnabled,
        rowSemantics = rowSemantics,
        onOpenDetail = onOpenDetail,
        onToggleFavorite = onToggleFavorite,
        onToggleMute = onToggleMute,
        onToggleShareActivity = onToggleShareActivity,
        onBlockClick = onBlockClick,
        onReportClick = onReportClick,
        modifier = modifier,
    )
}

/** Circle filter chip strip (All + per-circle). */
@Composable
fun CircleSelector(
    circles: List<FriendCircleItemDto>,
    selectedCircleId: String?,
    onSelectedCircleChange: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (circles.isEmpty()) return
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "all-friends") {
            CircleFilterButton(
                label = stringResource(R.string.friends_circle_filter_all),
                selected = selectedCircleId == null,
                icon = Icons.Outlined.Groups,
                onClick = { onSelectedCircleChange(null) },
            )
        }
        items(
            items = circles,
            key = { it.id },
            contentType = { LazyContentTypeCircle },
        ) { circle ->
            CircleFilterButton(
                label = circle.name,
                selected = selectedCircleId == circle.id,
                icon = Icons.Outlined.Hub,
                onClick = { onSelectedCircleChange(circle.id) },
            )
        }
    }
}

/** Username search + candidate list for the add-friend flow. */
@Composable
fun FriendSearchBar(
    username: String,
    onUsernameChange: (String) -> Unit,
    isSearching: Boolean,
    searchError: String?,
    candidates: List<FriendSearchCandidateDto>,
    mutationBusy: Boolean,
    onSearch: () -> Unit,
    onSendToUser: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val fieldShape = RoundedCornerShape(18.dp)
    val fieldColors =
        OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
        )
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedTextField(
            value = username,
            onValueChange = onUsernameChange,
            label = { Text(stringResource(R.string.friends_add_dialog_username_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = fieldShape,
            colors = fieldColors,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            ScaledOutlinedButton(
                onClick = onSearch,
                enabled = username.isNotBlank() && !isSearching && !mutationBusy,
                label = stringResource(R.string.friends_add_dialog_search),
                icon = Icons.Outlined.PersonSearch,
                loading = isSearching,
            )
        }
        searchError?.let { error ->
            Text(
                text = stringResource(R.string.friends_add_dialog_search_error, error),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
        candidates.takeIf { it.isNotEmpty() }?.let { list ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                list.forEach { candidate ->
                    val candidateName = candidate.full_name ?: candidate.username ?: candidate.id
                    val canSend = candidate.relationship_status == "can_send"
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(
                                text = candidateName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text =
                                    stringResource(
                                        when (candidate.relationship_status) {
                                            "friend" -> R.string.friends_search_status_friend
                                            "incoming_request" -> R.string.friends_search_status_incoming
                                            "outgoing_request" -> R.string.friends_search_status_outgoing
                                            else -> R.string.friends_search_status_can_send
                                        },
                                    ),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        TextButton(
                            onClick = { onSendToUser(candidate.id) },
                            enabled = canSend && !mutationBusy && !isSearching,
                        ) {
                            Text(stringResource(R.string.friends_add_dialog_send_short))
                        }
                    }
                }
            }
        }
    }
}

/** Full-screen friend detail (notes, circles, shared content). */
@Composable
fun FriendDetail(
    friend: FriendLiteItem,
    state: FriendsUiState,
    circles: List<FriendCircleItemDto>,
    noteDraft: String,
    onNoteDraftChange: (String) -> Unit,
    detailCircleIds: Set<String>,
    onDetailCircleToggle: (String, Boolean) -> Unit,
    sharedContent: List<SocialHubSharedContentItemDto>,
    isSharedContentLoading: Boolean,
    sharedContentError: String?,
    onLoadSharedContent: (String) -> Unit,
    onRetrySharedContent: () -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FriendDetailScreen(
        friend = friend,
        state = state,
        circles = circles,
        noteDraft = noteDraft,
        onNoteDraftChange = onNoteDraftChange,
        detailCircleIds = detailCircleIds,
        onDetailCircleToggle = onDetailCircleToggle,
        sharedContent = sharedContent,
        isSharedContentLoading = isSharedContentLoading,
        sharedContentError = sharedContentError,
        onLoadSharedContent = onLoadSharedContent,
        onRetrySharedContent = onRetrySharedContent,
        onSave = onSave,
        onBack = onBack,
        modifier = modifier,
    )
}
