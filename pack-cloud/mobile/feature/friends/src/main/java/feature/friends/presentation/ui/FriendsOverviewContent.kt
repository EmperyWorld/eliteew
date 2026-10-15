/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends overview list scaffold: hero, requests, Social Hub tools, circles, and sent requests.
 *
 * Invariants:
 * - Stable keys/content types are retained for animated request rows.
 * - Refresh and mutation busy states disable conflicting actions.
 *
 * Related:
 * - FriendsOverviewFriendList.kt
 * - FriendsFeature.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.ui.MobileAvatarPlaceholder
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.mobileAvatarInitials

@Composable
internal fun FriendsOverviewContent(
    state: FriendsUiState,
    socialHubInbox: List<SocialHubActionInboxItemDto>,
    socialHubInboxExpanded: Boolean,
    onToggleSocialHubInbox: () -> Unit,
    onExpandSocialHubInbox: () -> Unit,
    onSocialHubInboxItemClick: (SocialHubActionInboxItemDto) -> Unit,
    focusedSocialHubInboxItemId: String?,
    onFocusedSocialHubInboxItemConsumed: () -> Unit,
    privacyPreview: SocialHubPrivacyPreviewResponseDto?,
    showPrivacyWizard: Boolean,
    onOpenPrivacyPreview: () -> Unit,
    onDismissPrivacyWizard: () -> Unit,
    newCircleName: String,
    onNewCircleNameChange: (String) -> Unit,
    onCreateCircle: () -> Unit,
    onRenameCircle: (FriendCircleItemDto, String) -> Unit,
    onDeleteCircle: (FriendCircleItemDto) -> Unit,
    onOpenFullSocialHub: () -> Unit,
    onOpenActionCenter: () -> Unit = {},
    onAccept: (String) -> Unit,
    onCancelSentRequest: (String) -> Unit,
    onSearchUsers: (String) -> Unit,
    onOpenFriendDetail: (FriendLiteItem) -> Unit,
    onToggleFavorite: (FriendLiteItem) -> Unit,
    onToggleMute: (FriendLiteItem) -> Unit,
    onToggleShareActivity: (FriendLiteItem) -> Unit,
    onRequestBlockToggle: (FriendLiteItem) -> Unit,
    onShowAddFriend: () -> Unit,
    onPendingReject: (String) -> Unit,
    onPendingBlock: (FriendLiteItem) -> Unit,
    onPendingReport: (FriendLiteItem) -> Unit,
    referralInvite: FriendReferralInviteResponseDto?,
    isReferralLoading: Boolean,
    referralError: String?,
    onRetryReferralInvite: () -> Unit,
    onRetryRefresh: () -> Unit,
) {
    val requestsEmpty = state.incomingRequests.isEmpty()
    val refreshBusy = state.isLoading
    val mutationBusy = state.inFlightRequestId != null
    val allFriendsEmpty = state.friends.isEmpty()
    val focusedIncomingRequests =
        state.focusedRequestId?.let { focusedId ->
            state.incomingRequests.sortedWith(
                compareByDescending<world.empery.mobile.core.network.api.FriendRequestDto> {
                    it.id == focusedId
                }.thenBy { it.full_name ?: it.username ?: it.id },
            )
        } ?: state.incomingRequests

    var advancedExpanded by rememberSaveable { mutableStateOf(false) }
    var selectedCircleId by rememberSaveable { mutableStateOf<String?>(null) }
    var refreshErrorDismissed by rememberSaveable { mutableStateOf(false) }
    var actionErrorDismissed by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(state.error) {
        if (state.error != null) refreshErrorDismissed = false
    }
    LaunchedEffect(state.actionError) {
        if (state.actionError != null) actionErrorDismissed = false
    }
    LaunchedEffect(selectedCircleId, state.circles) {
        val id = selectedCircleId ?: return@LaunchedEffect
        if (state.circles.none { it.id == id }) selectedCircleId = null
    }

    val listCd = stringResource(R.string.friends_list_cd)
    val requestsLoadingHintCd = stringResource(R.string.friends_requests_loading_hint_cd)
    val acceptBlockedMutation = stringResource(R.string.friends_accept_blocked_mutation)
    val acceptBlockedRefresh = stringResource(R.string.friends_accept_blocked_refresh)
    val rejectBlockedMutation = stringResource(R.string.friends_reject_blocked_mutation)
    val rejectBlockedRefresh = stringResource(R.string.friends_reject_blocked_refresh)

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .semantics { contentDescription = listCd },
        contentPadding = PaddingValues(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(modifier = Modifier.height(4.dp)) }

        item {
            FriendsTabHero(
                friendsCount = state.friends.size,
                incomingCount = state.incomingRequests.size,
                sentCount = state.sentRequests.size,
                onSearch = onSearchUsers,
                onAddFriend = onShowAddFriend,
                addEnabled = !mutationBusy,
            )
        }

        item {
            FriendsActionCenterEntryCard(
                attentionCount = relationshipActionCenterAttentionCount(state.friends),
                inboxActionCount = socialHubInbox.size,
                onOpenActionCenter = onOpenActionCenter,
            )
        }

        item {
            FriendsTabQuickActions(
                inboxActionCount = socialHubInbox.size,
                onOpenInbox = onExpandSocialHubInbox,
                onOpenPrivacy = onOpenPrivacyPreview,
            )
        }

        // Referral / Social Hub tools live under Advanced — keep list first.

        item {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FriendsSectionTitle(text = stringResource(R.string.friends_section_incoming))
                if (state.incomingRequests.isNotEmpty()) {
                    PremiumBadge(text = state.incomingRequests.size.toString())
                }
            }
        }

        when {
            refreshBusy && requestsEmpty && allFriendsEmpty -> {
                item {
                    Text(
                        text = stringResource(R.string.friends_requests_loading_hint),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp)
                                .semantics { contentDescription = requestsLoadingHintCd },
                    )
                }
            }
            refreshBusy && requestsEmpty -> {
                item {
                    FriendsLoadingBlock(
                        message = stringResource(R.string.friends_requests_checking),
                        loadingSemantics = stringResource(R.string.friends_requests_checking),
                    )
                }
            }
            requestsEmpty -> {
                item {
                    FriendsEmptyHint(
                        title = stringResource(R.string.friends_requests_empty_title),
                        message = stringResource(R.string.friends_requests_empty_subtitle),
                        emptySemantics =
                            "${stringResource(R.string.friends_requests_empty_title)}. " +
                                stringResource(R.string.friends_requests_empty_subtitle),
                    )
                }
            }
            else -> {
                items(
                    items = focusedIncomingRequests,
                    key = { it.id },
                    contentType = { LazyContentTypeRequest },
                ) { request ->
                    val requesterName = request.full_name ?: request.username ?: request.id
                    val rowBusy = state.inFlightRequestId == request.id
                    val isFocusedRequest = state.focusedRequestId == request.id
                    val actionsEnabled = !refreshBusy && (state.inFlightRequestId == null || rowBusy)
                    val acceptCdBase = stringResource(R.string.friends_accept_cd, requesterName)
                    val rejectCdBase = stringResource(R.string.friends_reject_cd, requesterName)
                    val rowCd =
                        if (rowBusy) {
                            stringResource(R.string.friends_request_row_busy_cd, requesterName)
                        } else {
                            stringResource(R.string.friends_request_row_cd, requesterName)
                        }
                    val acceptSemanticCd =
                        when {
                            mutationBusy -> acceptBlockedMutation
                            refreshBusy -> acceptBlockedRefresh
                            else -> acceptCdBase
                        }
                    val rejectSemanticCd =
                        when {
                            mutationBusy -> rejectBlockedMutation
                            refreshBusy -> rejectBlockedRefresh
                            else -> rejectCdBase
                        }
                    val processingRowCd =
                        stringResource(R.string.friends_row_processing_cd, requesterName)
                    PremiumRowSurface(
                        modifier =
                            Modifier
                                .animateItem()
                                .semantics(mergeDescendants = true) {
                                    contentDescription = rowCd
                                },
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.56f),
                        borderColor =
                            if (isFocusedRequest) {
                                MaterialTheme.colorScheme.tertiary.copy(alpha = 0.7f)
                            } else {
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                            },
                        tonalElevation = if (isFocusedRequest) 6.dp else 3.dp,
                    ) {
                        MobileAvatarPlaceholder(
                            initials = mobileAvatarInitials(requesterName),
                            imageUrl = request.avatar_url,
                            contentDescription = requesterName,
                            modifier = Modifier.size(56.dp),
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = requesterName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.semantics { heading() },
                            )
                            if (rowBusy) {
                                Row(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .semantics(mergeDescendants = true) {
                                                contentDescription = processingRowCd
                                            },
                                    horizontalArrangement =
                                        Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp,
                                    )
                                    Text(
                                        text = stringResource(R.string.friends_row_processing),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            } else {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Button(
                                        onClick = { onAccept(request.id) },
                                        enabled = actionsEnabled,
                                        shape = RoundedCornerShape(12.dp),
                                        modifier =
                                            Modifier
                                                .weight(1f)
                                                .semantics { contentDescription = acceptSemanticCd },
                                    ) {
                                        Text(stringResource(R.string.friends_accept))
                                    }
                                    OutlinedButton(
                                        onClick = { onPendingReject(request.id) },
                                        enabled = actionsEnabled,
                                        shape = RoundedCornerShape(12.dp),
                                        modifier =
                                            Modifier
                                                .weight(1f)
                                                .semantics { contentDescription = rejectSemanticCd },
                                    ) {
                                        Text(stringResource(R.string.friends_reject))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            FriendsCollapsibleSectionHeader(
                title = stringResource(R.string.friends_advanced_section_title),
                expanded = advancedExpanded,
                onToggle = { advancedExpanded = !advancedExpanded },
                badge =
                    (socialHubInbox.size + state.circles.size + state.sentRequests.size)
                        .takeIf { it > 0 }
                        ?.toString(),
            )
        }

        if (advancedExpanded) {
            item {
                FriendsReferralInviteSection(
                    invite = referralInvite,
                    isLoading = isReferralLoading,
                    error = referralError,
                    busy = mutationBusy || refreshBusy,
                    onRetry = onRetryReferralInvite,
                )
            }
            item {
                FriendsFullSocialHubEntryCard(onOpenFullSocialHub = onOpenFullSocialHub)
            }
            item {
                SocialHubInboxSection(
                    items = socialHubInbox,
                    expanded = socialHubInboxExpanded,
                    onToggleExpanded = onToggleSocialHubInbox,
                    onItemClick = onSocialHubInboxItemClick,
                    focusedItemId = focusedSocialHubInboxItemId,
                    onFocusedItemConsumed = onFocusedSocialHubInboxItemConsumed,
                )
            }
            if (!showPrivacyWizard) {
                item {
                    FriendsPrivacyPreviewCard(
                        preview = privacyPreview,
                        onOpenWizard = onOpenPrivacyPreview,
                    )
                }
            }
            item {
                FriendsPrivacyPreviewWizard(
                    preview = privacyPreview,
                    visible = showPrivacyWizard,
                    onDismiss = onDismissPrivacyWizard,
                )
            }
            item {
                FriendsCircleManagementSection(
                    circles = state.circles,
                    newCircleName = newCircleName,
                    onNewCircleNameChange = onNewCircleNameChange,
                    onCreateCircle = onCreateCircle,
                    onRenameCircle = onRenameCircle,
                    onDeleteCircle = onDeleteCircle,
                    busy = mutationBusy || refreshBusy,
                )
            }
            item {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FriendsSectionTitle(text = stringResource(R.string.friends_section_sent))
                    if (state.sentRequests.isNotEmpty()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.45f),
                        ) {
                            Text(
                                text = state.sentRequests.size.toString(),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            )
                        }
                    }
                }
            }
            if (state.sentRequests.isEmpty()) {
                item {
                    FriendsEmptyHint(
                        title = stringResource(R.string.friends_section_sent),
                        message = stringResource(R.string.friends_sent_empty_subtitle),
                        emptySemantics =
                            "${stringResource(R.string.friends_section_sent)}. " +
                                stringResource(R.string.friends_sent_empty_subtitle),
                    )
                }
            } else {
                items(
                    items = state.sentRequests,
                    key = { it.id },
                    contentType = { LazyContentTypeSentRequest },
                ) { request ->
                    val targetName = request.full_name ?: request.username ?: request.id
                    val rowBusy = state.inFlightRequestId == request.id
                    val actionsEnabled = !refreshBusy && (state.inFlightRequestId == null || rowBusy)
                    val cancelCd =
                        when {
                            mutationBusy -> stringResource(R.string.friends_cancel_sent_blocked_mutation)
                            refreshBusy -> stringResource(R.string.friends_cancel_sent_blocked_refresh)
                            else -> stringResource(R.string.friends_cancel_sent_cd, targetName)
                        }
                    val rowCd =
                        if (rowBusy) {
                            stringResource(R.string.friends_sent_request_row_busy_cd, targetName)
                        } else {
                            stringResource(R.string.friends_sent_request_row_cd, targetName)
                        }
                    PremiumRowSurface(
                        modifier =
                            Modifier
                                .animateItem()
                                .semantics(mergeDescendants = true) { contentDescription = rowCd },
                        tonalElevation = 1.dp,
                    ) {
                        MobileAvatarPlaceholder(
                            initials = mobileAvatarInitials(targetName),
                            imageUrl = request.avatar_url,
                            contentDescription = targetName,
                            modifier = Modifier.size(48.dp),
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                text = targetName,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = stringResource(R.string.friends_sent_pending),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (rowBusy) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement =
                                        Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        strokeWidth = 2.dp,
                                    )
                                    Text(stringResource(R.string.friends_row_processing))
                                }
                            } else {
                                OutlinedButton(
                                    onClick = { onCancelSentRequest(request.id) },
                                    enabled = actionsEnabled,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier =
                                        Modifier.semantics {
                                            contentDescription = cancelCd
                                        },
                                ) {
                                    Text(stringResource(R.string.friends_cancel_sent))
                                }
                            }
                        }
                    }
                }
            }
        }

        FriendList(
            state = state,
            refreshBusy = refreshBusy,
            showRefreshError = state.error != null && !refreshErrorDismissed,
            onDismissRefreshError = { refreshErrorDismissed = true },
            onRetryRefresh = onRetryRefresh,
            showActionError = state.actionError != null && !actionErrorDismissed,
            onDismissActionError = { actionErrorDismissed = true },
            selectedCircleId = selectedCircleId,
            onSelectedCircleChange = { selectedCircleId = it },
            onOpenFriendDetail = onOpenFriendDetail,
            onToggleFavorite = onToggleFavorite,
            onToggleMute = onToggleMute,
            onToggleShareActivity = onToggleShareActivity,
            onRequestBlockToggle = onRequestBlockToggle,
            onPendingBlock = onPendingBlock,
            onPendingReport = onPendingReport,
        )
    }
}
