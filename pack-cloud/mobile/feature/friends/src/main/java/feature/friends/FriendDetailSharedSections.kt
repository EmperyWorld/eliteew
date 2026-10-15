/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friend detail timeline, shared-context metrics, and shared-content list (desktop FriendPersonCard parity).
 *
 * Invariants:
 * - Shared-content rows are API summaries only; no fabricated download URLs.
 *
 * Related:
 * - FriendDetailScreen.kt, FriendDetailTimelineSupport.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccessTime
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumChipPill
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
internal fun FriendDetailRelationshipActionCard(
    friend: FriendLiteItem,
    onOpenSharedTab: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(R.string.friends_relationship_action_center_title),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text =
                    when (friend.relationshipActionCenterState()) {
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
            TextButton(onClick = onOpenSharedTab, modifier = Modifier.align(Alignment.End)) {
                Text(stringResource(R.string.friends_detail_open_shared))
            }
        }
    }
}

@Composable
internal fun FriendDetailTimelineSection(
    friend: FriendLiteItem,
    modifier: Modifier = Modifier,
) {
    val entries = buildFriendTimelineEntries(friend)
    if (entries.isEmpty()) return
    val chrome = rememberMobileScaleChromePolicy()
    PremiumSectionCard(
        title = stringResource(R.string.friends_detail_timeline_title),
        subtitle = stringResource(R.string.friends_detail_timeline_subtitle, entries.size),
        icon = Icons.Outlined.AccessTime,
        modifier = modifier,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            entries.forEach { entry ->
                PremiumRowSurface {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(entry.labelRes),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = entry.value,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            maxLines = if (chrome.shouldStackChromeActions) 2 else 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FriendDetailSharedContextSection(
    friend: FriendLiteItem,
    modifier: Modifier = Modifier,
) {
    val locale = java.util.Locale.getDefault()
    val lastActivity = formatRelativeTimestamp(friend.lastActivityAt, locale)
    val circleNames = friend.circles.map { it.name }.filter { it.isNotBlank() }
    val relationshipFlags =
        listOfNotNull(
            if (friend.isFavorite) stringResource(R.string.friends_chip_favorite) else null,
            if (friend.isMuted) stringResource(R.string.friends_chip_muted) else null,
            if (friend.isBlocked) stringResource(R.string.friends_chip_blocked) else null,
        ).joinToString(", ")
            .ifBlank { stringResource(R.string.friends_detail_shared_relationship_normal) }

    PremiumSectionCard(
        title = stringResource(R.string.friends_detail_shared_context_title),
        subtitle = stringResource(R.string.friends_detail_shared_context_subtitle),
        icon = Icons.Outlined.Share,
        modifier = modifier,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SharedContextMetricRow(
                label = stringResource(R.string.friends_detail_shared_activity_sharing),
                value =
                    if (friend.shareActivityWithFriend) {
                        stringResource(R.string.friends_detail_shared_activity_visible)
                    } else {
                        stringResource(R.string.friends_detail_shared_activity_hidden)
                    },
            )
            SharedContextMetricRow(
                label = stringResource(R.string.friends_detail_shared_friend_activity),
                value =
                    if (friend.activityVisibleToCurrentUser) {
                        lastActivity ?: stringResource(R.string.friends_detail_shared_no_activity)
                    } else {
                        stringResource(R.string.friends_detail_shared_friend_activity_hidden)
                    },
            )
            SharedContextMetricRow(
                label = stringResource(R.string.friends_detail_shared_circles),
                value =
                    circleNames.joinToString(", ").ifBlank {
                        stringResource(R.string.friends_detail_circles_empty)
                    },
            )
            SharedContextMetricRow(
                label = stringResource(R.string.friends_detail_shared_relationship),
                value = relationshipFlags,
            )
        }
    }
}

@Composable
private fun SharedContextMetricRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FriendDetailSharedContentSection(
    items: List<SocialHubSharedContentItemDto>,
    isLoading: Boolean,
    errorMessage: String?,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val layout = LocalMobileWindowLayout.current
    when (val phase = resolveFriendSharedContentPhase(items, isLoading, errorMessage)) {
        FriendSharedContentPhase.Loading -> {
            PremiumLoadingCard(
                message = stringResource(R.string.friends_detail_shared_content_loading),
                modifier = modifier.fillMaxWidth(),
            )
        }
        is FriendSharedContentPhase.Error -> {
            PremiumSectionCard(
                title = stringResource(R.string.friends_detail_shared_content_title),
                subtitle = stringResource(R.string.friends_detail_shared_content_error_subtitle),
                icon = Icons.Outlined.Share,
                modifier = modifier,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = stringResource(R.string.friends_detail_shared_content_error, phase.message),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                    TextButton(onClick = onRetry) {
                        Text(stringResource(R.string.friends_detail_shared_content_retry))
                    }
                }
            }
        }
        FriendSharedContentPhase.Empty -> {
            val emptyCd = stringResource(R.string.friends_detail_shared_content_cd, 0)
            PremiumSectionCard(
                title = stringResource(R.string.friends_detail_shared_content_title),
                subtitle = stringResource(R.string.friends_detail_shared_content_empty_subtitle),
                icon = Icons.Outlined.Share,
                modifier = modifier.semantics { contentDescription = emptyCd },
            ) {
                Text(
                    text = stringResource(R.string.friends_detail_shared_content_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        is FriendSharedContentPhase.Ready -> {
            val sectionCd =
                stringResource(R.string.friends_detail_shared_content_cd, phase.items.size)
            PremiumSectionCard(
                title = stringResource(R.string.friends_detail_shared_content_title),
                subtitle =
                    stringResource(
                        R.string.friends_detail_shared_content_subtitle,
                        phase.fromFriendCount,
                        phase.toFriendCount,
                    ),
                icon = Icons.Outlined.Share,
                modifier = modifier.semantics { contentDescription = sectionCd },
            ) {
                if (layout.widthClass >= MobileWindowWidthClass.Medium && !chrome.shouldStackChromeActions) {
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        phase.items.take(12).forEach { item ->
                            SharedContentChip(item = item)
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        phase.items.take(12).forEach { item ->
                            SharedContentRow(item = item)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SharedContentRow(item: SocialHubSharedContentItemDto) {
    val title = sharedContentDisplayTitle(item)
    val directionLabel =
        if (item.direction == "from_friend") {
            stringResource(R.string.friends_detail_shared_content_from_friend)
        } else {
            stringResource(R.string.friends_detail_shared_content_to_friend)
        }
    val whenLabel = formatRelativeTimestamp(item.updated_at) ?: item.updated_at
    PremiumRowSurface {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = stringResource(R.string.friends_detail_shared_content_row_meta, directionLabel, whenLabel),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SharedContentChip(item: SocialHubSharedContentItemDto) {
    val title = sharedContentDisplayTitle(item)
    PremiumChipPill(
        text = title,
        containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.55f),
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
    )
}

@Composable
internal fun FriendDetailCirclesEditor(
    circles: List<FriendCircleItemDto>,
    selectedCircleIds: Set<String>,
    onCircleToggle: (String, Boolean) -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier,
) {
    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = stringResource(R.string.friends_detail_circles_title),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.semantics { heading() },
            )
            if (circles.isEmpty()) {
                Text(
                    text = stringResource(R.string.friends_detail_circles_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                circles.forEach { circle ->
                    val checked = selectedCircleIds.contains(circle.id)
                    PremiumRowSurface {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = circle.name,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                text = stringResource(R.string.friends_circle_count, circle.members_count),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        TextButton(
                            onClick = { onCircleToggle(circle.id, !checked) },
                            enabled = enabled,
                        ) {
                            Text(
                                if (checked) {
                                    stringResource(R.string.friends_detail_circle_remove)
                                } else {
                                    stringResource(R.string.friends_detail_circle_add)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
