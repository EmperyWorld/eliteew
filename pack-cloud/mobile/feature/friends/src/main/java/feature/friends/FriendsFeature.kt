/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile Social Hub Compose UI orchestrator ([FriendsLiteScreen]).
 * Repository/models: FriendsRepository.kt / FriendsModels.kt.
 *
 * Related:
 * - FriendListSection, FriendSearchSection, FriendRelationshipManager
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsLiteScreen(
    state: FriendsUiState,
    onAccept: (String) -> Unit,
    onReject: (String) -> Unit,
    onCancelSentRequest: (String) -> Unit,
    onSearchUsers: (String) -> Unit,
    onSendRequestToUser: (String) -> Unit,
    onSendRequest: (String) -> Unit,
    onToggleFavorite: (FriendLiteItem) -> Unit,
    onToggleMute: (FriendLiteItem) -> Unit,
    onToggleShareActivity: (FriendLiteItem) -> Unit,
    onRequestBlockToggle: (FriendLiteItem) -> Unit,
    onReportUser: (FriendLiteItem, String, String?) -> Unit,
    onOpenFriendDetail: (FriendLiteItem) -> Unit,
    onDismissFriendDetail: () -> Unit,
    onSaveFriendDetail: (FriendLiteItem, String, List<String>) -> Unit,
    socialHubInbox: List<world.empery.mobile.core.network.api.SocialHubActionInboxItemDto> = emptyList(),
    socialHubInboxExpanded: Boolean = true,
    onToggleSocialHubInbox: () -> Unit = {},
    onExpandSocialHubInbox: () -> Unit = {},
    onSocialHubInboxItemClick: (world.empery.mobile.core.network.api.SocialHubActionInboxItemDto) -> Unit = {},
    focusedSocialHubInboxItemId: String? = null,
    onFocusedSocialHubInboxItemConsumed: () -> Unit = {},
    privacyPreview: world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto? = null,
    showPrivacyWizard: Boolean = false,
    onOpenPrivacyPreview: () -> Unit = {},
    onDismissPrivacyWizard: () -> Unit = {},
    newCircleName: String = "",
    onNewCircleNameChange: (String) -> Unit = {},
    onCreateCircle: () -> Unit = {},
    onRenameCircle: (FriendCircleItemDto, String) -> Unit = { _, _ -> },
    onDeleteCircle: (FriendCircleItemDto) -> Unit = {},
    useFriendDetailScreen: Boolean = false,
    onBackFromFriendDetail: () -> Unit = {},
    onOpenFullSocialHub: () -> Unit = {},
    onOpenActionCenter: () -> Unit = {},
    onLoadFriendSharedContent: (String) -> Unit = {},
    onRetryFriendSharedContent: () -> Unit = {},
    referralInvite: world.empery.mobile.core.network.api.FriendReferralInviteResponseDto? = null,
    isReferralLoading: Boolean = false,
    referralError: String? = null,
    onRetryReferralInvite: () -> Unit = {},
    onRetryRefresh: () -> Unit = {},
) {
    val refreshBusy = state.isLoading
    val mutationBusy = state.inFlightRequestId != null

    var pendingRejectRequestId by remember { mutableStateOf<String?>(null) }
    var pendingBlockFriend by remember { mutableStateOf<FriendLiteItem?>(null) }
    var pendingReportFriend by remember { mutableStateOf<FriendLiteItem?>(null) }
    var reportReason by remember { mutableStateOf("") }
    var reportDetails by remember { mutableStateOf("") }
    var detailNoteDraft by remember { mutableStateOf("") }
    var detailCircleIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showAddFriendDialog by remember { mutableStateOf(false) }
    var addFriendUsername by remember { mutableStateOf("") }
    val pendingRejectName =
        pendingRejectRequestId?.let { id ->
            state.incomingRequests.firstOrNull { it.id == id }?.let { r ->
                r.full_name ?: r.username ?: r.id
            }
        }

    val selectedFriendProfile = state.selectedFriendProfile
    if (useFriendDetailScreen && selectedFriendProfile != null) {
        FriendDetail(
            friend = selectedFriendProfile,
            state = state,
            circles = state.circles,
            noteDraft = detailNoteDraft,
            onNoteDraftChange = { detailNoteDraft = it.take(2000) },
            detailCircleIds = detailCircleIds,
            onDetailCircleToggle = { circleId, checked ->
                detailCircleIds =
                    if (checked) {
                        detailCircleIds + circleId
                    } else {
                        detailCircleIds - circleId
                    }
            },
            sharedContent = state.friendSharedContent,
            isSharedContentLoading = state.isFriendSharedContentLoading,
            sharedContentError = state.friendSharedContentError,
            onLoadSharedContent = onLoadFriendSharedContent,
            onRetrySharedContent = onRetryFriendSharedContent,
            onSave = {
                onSaveFriendDetail(
                    selectedFriendProfile,
                    detailNoteDraft,
                    detailCircleIds.toList(),
                )
            },
            onBack = onBackFromFriendDetail,
        )
        return
    }

    val rejectDialogCancelCd = stringResource(R.string.friends_reject_dialog_cancel_cd)

    LaunchedEffect(pendingRejectRequestId, state.incomingRequests) {
        val id = pendingRejectRequestId ?: return@LaunchedEffect
        if (state.incomingRequests.none { it.id == id }) {
            pendingRejectRequestId = null
        }
    }
    LaunchedEffect(
        state.selectedFriendProfile?.id,
        state.selectedFriendProfile?.privateNote,
        state.selectedFriendProfile?.circles,
    ) {
        val profile = state.selectedFriendProfile ?: return@LaunchedEffect
        detailNoteDraft = profile.privateNote.orEmpty()
        detailCircleIds = profile.circles.map { it.id }.toSet()
    }

    if (pendingRejectRequestId != null && pendingRejectName != null) {
        val nameForDialog = pendingRejectName
        val idToReject = pendingRejectRequestId!!
        val confirmCd = stringResource(R.string.friends_reject_dialog_confirm_cd, nameForDialog)
        AlertDialog(
            onDismissRequest = { pendingRejectRequestId = null },
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            title = {
                Text(
                    text = stringResource(R.string.friends_reject_dialog_title),
                    modifier = Modifier.semantics { heading() },
                )
            },
            text = {
                Text(text = stringResource(R.string.friends_reject_dialog_body, nameForDialog))
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onReject(idToReject)
                        pendingRejectRequestId = null
                    },
                    enabled = !mutationBusy && !refreshBusy,
                    modifier = Modifier.semantics { contentDescription = confirmCd },
                ) {
                    Text(stringResource(R.string.friends_reject_dialog_confirm))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { pendingRejectRequestId = null },
                    modifier =
                        Modifier.semantics {
                            contentDescription = rejectDialogCancelCd
                        },
                ) {
                    Text(stringResource(R.string.friends_reject_dialog_cancel))
                }
            },
        )
    }

    pendingBlockFriend?.let { friendToBlock ->
        val displayName = friendToBlock.fullName ?: friendToBlock.username ?: friendToBlock.id
        AlertDialog(
            onDismissRequest = { pendingBlockFriend = null },
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            title = { Text(stringResource(R.string.friends_block_dialog_title)) },
            text = { Text(stringResource(R.string.friends_block_dialog_body, displayName)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onRequestBlockToggle(friendToBlock)
                        pendingBlockFriend = null
                    },
                    enabled = !mutationBusy && !refreshBusy,
                ) {
                    Text(stringResource(R.string.friends_block_dialog_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingBlockFriend = null }) {
                    Text(stringResource(R.string.friends_reject_dialog_cancel))
                }
            },
        )
    }

    pendingReportFriend?.let { friendToReport ->
        val displayName = friendToReport.fullName ?: friendToReport.username ?: friendToReport.id
        val reasonTrimmed = reportReason.trim()
        val detailsTrimmed = reportDetails.trim()
        val fieldShape = RoundedCornerShape(18.dp)
        val fieldColors =
            OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
            )
        AlertDialog(
            onDismissRequest = {
                pendingReportFriend = null
                reportReason = ""
                reportDetails = ""
            },
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            title = { Text(stringResource(R.string.friends_report_dialog_title, displayName)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = stringResource(R.string.friends_report_dialog_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = reportReason,
                        onValueChange = { reportReason = it.take(80) },
                        label = { Text(stringResource(R.string.friends_report_reason_label)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = fieldShape,
                        colors = fieldColors,
                    )
                    OutlinedTextField(
                        value = reportDetails,
                        onValueChange = { reportDetails = it.take(2000) },
                        label = { Text(stringResource(R.string.friends_report_details_label)) },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                        shape = fieldShape,
                        colors = fieldColors,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onReportUser(
                            friendToReport,
                            reasonTrimmed,
                            detailsTrimmed.ifBlank { null },
                        )
                        pendingReportFriend = null
                        reportReason = ""
                        reportDetails = ""
                    },
                    enabled = reasonTrimmed.isNotBlank() && !mutationBusy && !refreshBusy,
                ) {
                    Text(stringResource(R.string.friends_report_dialog_confirm))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        pendingReportFriend = null
                        reportReason = ""
                        reportDetails = ""
                    },
                ) {
                    Text(stringResource(R.string.friends_reject_dialog_cancel))
                }
            },
        )
    }

    state.selectedFriendProfile?.let { detailFriend ->
        val displayName = detailFriend.fullName ?: detailFriend.username ?: detailFriend.id
        val fieldShape = RoundedCornerShape(18.dp)
        val fieldColors =
            OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
            )
        AlertDialog(
            onDismissRequest = onDismissFriendDetail,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            title = { Text(stringResource(R.string.friends_detail_title, displayName)) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (state.isFriendDetailLoading) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                            )
                            Text(
                                text = stringResource(R.string.friends_detail_loading),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    state.friendDetailError?.let { err ->
                        Text(
                            text = stringResource(R.string.friends_detail_error, err),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                    Text(
                        text = stringResource(R.string.friends_relationship_action_center_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text =
                            when (detailFriend.relationshipActionCenterState()) {
                                FriendRelationshipActionCenterState.BLOCKED ->
                                    stringResource(R.string.friends_relationship_action_blocked)
                                FriendRelationshipActionCenterState.MUTED ->
                                    stringResource(R.string.friends_relationship_action_muted)
                                FriendRelationshipActionCenterState.PRIVACY ->
                                    stringResource(R.string.friends_relationship_action_privacy)
                                FriendRelationshipActionCenterState.START ->
                                    stringResource(R.string.friends_relationship_action_start)
                                FriendRelationshipActionCenterState.READY ->
                                    stringResource(R.string.friends_relationship_action_ready)
                            },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = detailNoteDraft,
                        onValueChange = { detailNoteDraft = it.take(2000) },
                        label = { Text(stringResource(R.string.friends_detail_note_label)) },
                        minLines = 4,
                        modifier = Modifier.fillMaxWidth(),
                        shape = fieldShape,
                        colors = fieldColors,
                    )
                    Text(
                        text = stringResource(R.string.friends_detail_circles_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (state.circles.isEmpty()) {
                        Text(
                            text = stringResource(R.string.friends_detail_circles_empty),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            state.circles.forEach { circle ->
                                val checked = detailCircleIds.contains(circle.id)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Checkbox(
                                        checked = checked,
                                        onCheckedChange = { isChecked ->
                                            detailCircleIds =
                                                if (isChecked) {
                                                    detailCircleIds + circle.id
                                                } else {
                                                    detailCircleIds - circle.id
                                                }
                                        },
                                        enabled = !mutationBusy && !state.isFriendDetailLoading,
                                    )
                                    Column {
                                        Text(
                                            text = circle.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                        Text(
                                            text =
                                                stringResource(
                                                    R.string.friends_circle_count,
                                                    circle.members_count,
                                                ),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Text(
                        text = stringResource(R.string.friends_detail_privacy_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onSaveFriendDetail(
                            detailFriend,
                            detailNoteDraft,
                            detailCircleIds.toList(),
                        )
                    },
                    enabled = !mutationBusy && !state.isFriendDetailLoading,
                ) {
                    Text(stringResource(R.string.friends_detail_save))
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissFriendDetail) {
                    Text(stringResource(R.string.friends_reject_dialog_cancel))
                }
            },
        )
    }

    if (showAddFriendDialog) {
        AlertDialog(
            onDismissRequest = { showAddFriendDialog = false },
            title = { Text(stringResource(R.string.friends_add_dialog_title)) },
            text = {
                FriendSearchBar(
                    username = addFriendUsername,
                    onUsernameChange = { addFriendUsername = it },
                    isSearching = state.isSearching,
                    searchError = state.searchError,
                    candidates = state.searchCandidates,
                    mutationBusy = mutationBusy,
                    onSearch = { onSearchUsers(addFriendUsername.trim()) },
                    onSendToUser = onSendRequestToUser,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (addFriendUsername.isNotBlank()) {
                            onSendRequest(addFriendUsername.trim())
                            showAddFriendDialog = false
                            addFriendUsername = ""
                        }
                    },
                    enabled = addFriendUsername.isNotBlank() && !mutationBusy,
                ) {
                    Text(stringResource(R.string.friends_add_dialog_send))
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddFriendDialog = false }) {
                    Text(stringResource(R.string.friends_add_dialog_cancel))
                }
            },
        )
    }

    FriendsOverviewContent(
        state = state,
        socialHubInbox = socialHubInbox,
        socialHubInboxExpanded = socialHubInboxExpanded,
        onToggleSocialHubInbox = onToggleSocialHubInbox,
        onExpandSocialHubInbox = onExpandSocialHubInbox,
        onSocialHubInboxItemClick = onSocialHubInboxItemClick,
        focusedSocialHubInboxItemId = focusedSocialHubInboxItemId,
        onFocusedSocialHubInboxItemConsumed = onFocusedSocialHubInboxItemConsumed,
        privacyPreview = privacyPreview,
        showPrivacyWizard = showPrivacyWizard,
        onOpenPrivacyPreview = onOpenPrivacyPreview,
        onDismissPrivacyWizard = onDismissPrivacyWizard,
        newCircleName = newCircleName,
        onNewCircleNameChange = onNewCircleNameChange,
        onCreateCircle = onCreateCircle,
        onRenameCircle = onRenameCircle,
        onDeleteCircle = onDeleteCircle,
        onOpenFullSocialHub = onOpenFullSocialHub,
        onOpenActionCenter = onOpenActionCenter,
        onAccept = onAccept,
        onCancelSentRequest = onCancelSentRequest,
        onSearchUsers = onSearchUsers,
        onOpenFriendDetail = onOpenFriendDetail,
        onToggleFavorite = onToggleFavorite,
        onToggleMute = onToggleMute,
        onToggleShareActivity = onToggleShareActivity,
        onRequestBlockToggle = onRequestBlockToggle,
        onShowAddFriend = { showAddFriendDialog = true },
        onPendingReject = { pendingRejectRequestId = it },
        onPendingBlock = { pendingBlockFriend = it },
        onPendingReport = {
            pendingReportFriend = it
            reportReason = ""
            reportDetails = ""
        },
        referralInvite = referralInvite,
        isReferralLoading = isReferralLoading,
        referralError = referralError,
        onRetryReferralInvite = onRetryReferralInvite,
        onRetryRefresh = onRetryRefresh,
    )
}
