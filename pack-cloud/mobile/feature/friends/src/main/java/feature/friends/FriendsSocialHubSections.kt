/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * friends-002/006/007/009/010: Social Hub inbox, circles management, privacy wizard, report presets, relationship chips.
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.network.api.SocialHubPrivacyPreviewResponseDto
import world.empery.mobile.core.ui.PremiumChipPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Shield

@Composable
internal fun FriendsSocialHubCommandCenter(
    friendsCount: Int,
    incomingCount: Int,
    sentCount: Int,
    inboxActionCount: Int,
    circlesCount: Int,
    onOpenInbox: () -> Unit,
    onOpenPrivacy: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.friends_social_hub_command_title),
        subtitle = stringResource(R.string.friends_social_hub_command_subtitle),
        icon = Icons.Outlined.Hub,
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PremiumChipPill(text = stringResource(R.string.friends_social_hub_command_friends, friendsCount))
            PremiumChipPill(text = stringResource(R.string.friends_social_hub_command_incoming, incomingCount))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PremiumChipPill(text = stringResource(R.string.friends_social_hub_command_sent, sentCount))
            PremiumChipPill(text = stringResource(R.string.friends_social_hub_command_lists, circlesCount))
        }
        PremiumRowSurface {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = stringResource(R.string.friends_social_hub_command_inbox_title, inboxActionCount),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.friends_social_hub_command_inbox_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = onOpenInbox) {
                Text(stringResource(R.string.friends_social_hub_command_open_inbox))
            }
        }
        TextButton(onClick = onOpenPrivacy, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.friends_social_hub_command_privacy))
        }
    }
}

@Composable
internal fun FriendsFullSocialHubEntryCard(
    onOpenFullSocialHub: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.friends_full_social_hub_title),
        subtitle = stringResource(R.string.friends_full_social_hub_subtitle),
        icon = Icons.Outlined.Hub,
        modifier = modifier,
    ) {
        TextButton(onClick = onOpenFullSocialHub, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.friends_full_social_hub_open))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
internal fun FriendRelationshipChips(
    chips: List<FriendRelationshipChip>,
    modifier: Modifier = Modifier,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        chips.forEach { chip ->
            PremiumChipPill(text = chipLabel(chip))
        }
    }
}

@Composable
private fun chipLabel(chip: FriendRelationshipChip): String =
    when (chip) {
        FriendRelationshipChip.FRIEND -> stringResource(R.string.friends_chip_friend)
        FriendRelationshipChip.REQUEST_PENDING -> stringResource(R.string.friends_chip_request_pending)
        FriendRelationshipChip.MUTED -> stringResource(R.string.friends_chip_muted)
        FriendRelationshipChip.BLOCKED -> stringResource(R.string.friends_chip_blocked)
        FriendRelationshipChip.FAVORITE -> stringResource(R.string.friends_chip_favorite)
        FriendRelationshipChip.ACTIVITY_SHARED -> stringResource(R.string.friends_chip_activity_shared)
        FriendRelationshipChip.ACTIVITY_HIDDEN -> stringResource(R.string.friends_chip_activity_hidden)
    }

@Composable
internal fun SocialHubInboxSection(
    items: List<SocialHubActionInboxItemDto>,
    expanded: Boolean,
    onToggleExpanded: () -> Unit,
    onItemClick: (SocialHubActionInboxItemDto) -> Unit,
    modifier: Modifier = Modifier,
    focusedItemId: String? = null,
    onFocusedItemConsumed: () -> Unit = {},
) {
    LaunchedEffect(focusedItemId) {
        if (focusedItemId.isNullOrBlank()) return@LaunchedEffect
        kotlinx.coroutines.delay(2500)
        onFocusedItemConsumed()
    }
    val cd = stringResource(R.string.friends_social_hub_inbox_cd, items.size)
    PremiumSectionCard(
        title = stringResource(R.string.friends_social_hub_inbox_title),
        subtitle = if (expanded) null else stringResource(R.string.friends_social_hub_inbox_cd, items.size),
        icon = Icons.Outlined.Inbox,
        modifier = modifier.semantics { contentDescription = cd },
    ) {
        TextButton(onClick = onToggleExpanded) {
            Text(if (expanded) stringResource(R.string.friends_error_dismiss) else stringResource(R.string.friends_social_hub_inbox_title))
        }
        if (!expanded) return@PremiumSectionCard
        if (items.isEmpty()) {
            Text(stringResource(R.string.friends_social_hub_inbox_empty))
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items.forEach { item ->
                    val highlighted = !focusedItemId.isNullOrBlank() && item.id == focusedItemId
                    TextButton(
                        onClick = { onItemClick(item) },
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .then(
                                    if (highlighted) {
                                        Modifier.background(
                                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
                                            RoundedCornerShape(12.dp),
                                        )
                                    } else {
                                        Modifier
                                    },
                                ),
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text(item.title, fontWeight = FontWeight.SemiBold)
                            Text(item.summary, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
internal fun FriendsCircleManagementSection(
    circles: List<FriendCircleItemDto>,
    newCircleName: String,
    onNewCircleNameChange: (String) -> Unit,
    onCreateCircle: () -> Unit,
    onRenameCircle: (FriendCircleItemDto, String) -> Unit,
    onDeleteCircle: (FriendCircleItemDto) -> Unit,
    busy: Boolean,
    modifier: Modifier = Modifier,
) {
    var renameTarget by remember { mutableStateOf<FriendCircleItemDto?>(null) }
    var renameDraft by remember { mutableStateOf("") }
    PremiumSectionCard(
        title = stringResource(R.string.friends_circles_manage_title),
        subtitle = stringResource(R.string.friends_circles_delete_warning),
        icon = Icons.Outlined.Shield,
        modifier = modifier,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = newCircleName,
                onValueChange = onNewCircleNameChange,
                label = { Text(stringResource(R.string.friends_circles_create_hint)) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                enabled = !busy,
            )
            TextButton(onClick = onCreateCircle, enabled = !busy && newCircleName.isNotBlank()) {
                Text(stringResource(R.string.friends_circles_create))
            }
        }
        circles.forEach { circle ->
            PremiumRowSurface {
                Text(circle.name, modifier = Modifier.weight(1f))
                TextButton(
                    onClick = {
                        renameTarget = circle
                        renameDraft = circle.name
                    },
                    enabled = !busy,
                ) {
                    Text(stringResource(R.string.friends_circles_rename))
                }
                TextButton(onClick = { onDeleteCircle(circle) }, enabled = !busy) {
                    Text(stringResource(R.string.friends_circles_delete))
                }
            }
        }
    }

    renameTarget?.let { circle ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text(stringResource(R.string.friends_circles_rename_title)) },
            text = {
                OutlinedTextField(
                    value = renameDraft,
                    onValueChange = { renameDraft = it },
                    label = { Text(stringResource(R.string.friends_circles_rename_hint)) },
                    singleLine = true,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val trimmed = renameDraft.trim()
                        if (trimmed.isNotBlank() && trimmed != circle.name) {
                            onRenameCircle(circle, trimmed)
                        }
                        renameTarget = null
                    },
                    enabled = !busy && renameDraft.trim().isNotBlank(),
                ) {
                    Text(stringResource(R.string.friends_circles_rename))
                }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) {
                    Text(stringResource(R.string.friends_error_dismiss))
                }
            },
        )
    }
}

@Composable
internal fun FriendsPrivacyPreviewCard(
    preview: SocialHubPrivacyPreviewResponseDto?,
    onOpenWizard: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (preview == null) return
    PremiumSectionCard(
        title = stringResource(R.string.friends_privacy_wizard_title),
        subtitle = preview.discoverability,
        icon = Icons.Outlined.Shield,
        modifier = modifier,
    ) {
        if (preview.warnings.isNotEmpty()) {
            Text(
                stringResource(R.string.friends_privacy_preview_warnings, preview.warnings.size),
                style = MaterialTheme.typography.bodySmall,
            )
        }
        TextButton(onClick = onOpenWizard) {
            Text(stringResource(R.string.friends_privacy_preview_open))
        }
    }
}

@Composable
internal fun FriendsPrivacyPreviewWizard(
    preview: SocialHubPrivacyPreviewResponseDto?,
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!visible || preview == null) return
    var step by remember(preview) { mutableIntStateOf(0) }
    val fields = listOf("avatar", "full_name", "bio", "activity")
    val fieldLabels =
        mapOf(
            "avatar" to R.string.friends_privacy_field_avatar,
            "full_name" to R.string.friends_privacy_field_full_name,
            "bio" to R.string.friends_privacy_field_bio,
            "activity" to R.string.friends_privacy_field_activity,
        )
    PremiumSectionCard(
        title = stringResource(R.string.friends_privacy_wizard_title),
        subtitle = preview.discoverability,
        icon = Icons.Outlined.Shield,
        modifier = modifier,
    ) {
        val key = fields.getOrNull(step) ?: fields.last()
        val visibility = preview.fields[key]?.visibility ?: "—"
        Text(stringResource(fieldLabels[key] ?: R.string.friends_privacy_field_avatar))
        Text(visibility, style = MaterialTheme.typography.bodySmall)
        preview.warnings.forEach { warning ->
            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)) {
                Text(warning, modifier = Modifier.padding(8.dp), style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (step < fields.lastIndex) {
                TextButton(onClick = { step += 1 }) {
                    Text(stringResource(R.string.friends_privacy_wizard_next))
                }
            } else {
                TextButton(onClick = onDismiss) {
                    Text(stringResource(R.string.friends_privacy_wizard_done))
                }
            }
        }
    }
}

@Composable
internal fun FriendReportPresetRow(
    selected: FriendReportPreset?,
    onSelect: (FriendReportPreset) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        FriendReportPreset.entries.forEach { preset ->
            FilterChip(
                selected = selected == preset,
                onClick = { onSelect(preset) },
                label = { Text(stringResource(preset.defaultReasonLabelRes())) },
            )
        }
    }
}
