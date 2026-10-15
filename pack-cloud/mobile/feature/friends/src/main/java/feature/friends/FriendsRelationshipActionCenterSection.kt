/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Relationship action center — multi-signal overview, stale contacts, inbox signals, attention friends.
 *
 * Invariants:
 * - Renders nothing when no signals and no attention friends.
 *
 * Related:
 * - FriendsFeature.kt, FriendsRelationshipActionCenterSupport.kt
 */
package feature.friends

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Icon
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
import world.empery.mobile.core.network.api.SocialHubActionInboxItemDto
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FriendsRelationshipActionCenterSection(
    friends: List<FriendLiteItem>,
    incomingCount: Int,
    sentCount: Int,
    inboxItems: List<SocialHubActionInboxItemDto>,
    onOpenFriend: (FriendLiteItem) -> Unit,
    onOpenInbox: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onInboxItemClick: (SocialHubActionInboxItemDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    val attentionFriends =
        friends.filter { friend ->
            friend.relationshipActionCenterState() != FriendRelationshipActionCenterState.READY
        }
    val staleContacts = detectStaleContactFriends(friends)
    val inboxSignals = rankInboxSignalsForActionCenter(inboxItems)
    val hasContent =
        attentionFriends.isNotEmpty() ||
            staleContacts.isNotEmpty() ||
            inboxSignals.isNotEmpty() ||
            friends.isNotEmpty()

    if (!hasContent) return

    val chrome = rememberMobileScaleChromePolicy()
    val layout = LocalMobileWindowLayout.current
    val kpis = buildFriendsRelationshipOverviewKpis(friends, incomingCount, sentCount)
    val grouped =
        attentionFriends.groupBy { it.relationshipActionCenterState() }
            .toSortedMap(compareBy { state ->
                when (state) {
                    FriendRelationshipActionCenterState.BLOCKED -> 0
                    FriendRelationshipActionCenterState.MUTED -> 1
                    FriendRelationshipActionCenterState.PRIVACY -> 2
                    FriendRelationshipActionCenterState.START -> 3
                    FriendRelationshipActionCenterState.READY -> 4
                }
            })

    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PremiumIconTile(
                    icon = Icons.Outlined.Hub,
                    contentDescription = stringResource(R.string.friends_relationship_action_center_title),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.friends_relationship_action_center_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text =
                            stringResource(
                                R.string.friends_relationship_action_center_subtitle,
                                attentionFriends.size + staleContacts.size,
                                inboxItems.size,
                            ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = if (chrome.shouldStackChromeActions) 3 else 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Text(
                text = stringResource(R.string.friends_relationship_action_overview_title),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                kpis.forEach { kpi ->
                    PremiumMetricPill(
                        label = kpiLabel(kpi.id),
                        value = kpi.count.toString(),
                    )
                }
            }

            if (inboxSignals.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.friends_relationship_action_inbox_signals_title),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
                inboxSignals.forEach { signal ->
                    InboxSignalRow(
                        item = signal.item,
                        onClick = { onInboxItemClick(signal.item) },
                    )
                }
                TextButton(onClick = onOpenInbox, modifier = Modifier.align(Alignment.End)) {
                    Text(stringResource(R.string.friends_social_hub_command_open_inbox))
                }
            }

            if (staleContacts.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.friends_relationship_action_stale_title, staleContacts.size),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    text = stringResource(R.string.friends_relationship_action_stale_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val stalePreview =
                    if (layout.widthClass >= MobileWindowWidthClass.Medium && !chrome.shouldStackChromeActions) {
                        6
                    } else {
                        4
                    }
                staleContacts.take(stalePreview).forEach { friend ->
                    AttentionFriendRow(
                        friend = friend,
                        subtitle = stringResource(R.string.friends_relationship_action_stale_row),
                        onOpenFriend = onOpenFriend,
                    )
                }
                if (staleContacts.size > stalePreview) {
                    Text(
                        text = stringResource(R.string.friends_relationship_action_center_more, staleContacts.size - stalePreview),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            grouped.forEach { (state, items) ->
                val groupLabel = relationshipGroupLabel(state) ?: return@forEach
                Text(
                    text = groupLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
                items.take(5).forEach { friend ->
                    AttentionFriendRow(
                        friend = friend,
                        subtitle = relationshipActionLabel(state),
                        onOpenFriend = onOpenFriend,
                        groupLabel = groupLabel,
                    )
                }
                if (items.size > 5) {
                    Text(
                        text = stringResource(R.string.friends_relationship_action_center_more, items.size - 5),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (inboxItems.isEmpty() && attentionFriends.isEmpty() && staleContacts.isEmpty()) {
                Text(
                    text = stringResource(R.string.friends_relationship_action_center_all_clear),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = if (chrome.shouldStackChromeActions) Arrangement.spacedBy(8.dp) else Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onOpenPrivacy) {
                    Icon(Icons.Outlined.Shield, contentDescription = null)
                    Text(stringResource(R.string.friends_quick_privacy))
                }
                if (inboxItems.isEmpty() && inboxSignals.isEmpty()) {
                    TextButton(onClick = onOpenInbox) {
                        Icon(Icons.Outlined.Inbox, contentDescription = null)
                        Text(stringResource(R.string.friends_quick_inbox))
                    }
                }
            }
        }
    }
}

@Composable
private fun kpiLabel(id: String): String =
    when (id) {
        "friends" -> stringResource(R.string.friends_relationship_kpi_friends)
        "incoming" -> stringResource(R.string.friends_relationship_kpi_incoming)
        "sent" -> stringResource(R.string.friends_relationship_kpi_sent)
        "favorites" -> stringResource(R.string.friends_relationship_kpi_favorites)
        "limited" -> stringResource(R.string.friends_relationship_kpi_limited)
        else -> id
    }

@Composable
private fun relationshipGroupLabel(state: FriendRelationshipActionCenterState): String? =
    when (state) {
        FriendRelationshipActionCenterState.BLOCKED -> stringResource(R.string.friends_relationship_action_group_blocked)
        FriendRelationshipActionCenterState.MUTED -> stringResource(R.string.friends_relationship_action_group_muted)
        FriendRelationshipActionCenterState.PRIVACY -> stringResource(R.string.friends_relationship_action_group_privacy)
        FriendRelationshipActionCenterState.START -> stringResource(R.string.friends_relationship_action_group_start)
        FriendRelationshipActionCenterState.READY -> null
    }

@Composable
private fun relationshipActionLabel(state: FriendRelationshipActionCenterState): String =
    when (state) {
        FriendRelationshipActionCenterState.BLOCKED -> stringResource(R.string.friends_relationship_action_blocked)
        FriendRelationshipActionCenterState.MUTED -> stringResource(R.string.friends_relationship_action_muted)
        FriendRelationshipActionCenterState.PRIVACY -> stringResource(R.string.friends_relationship_action_privacy)
        FriendRelationshipActionCenterState.START -> stringResource(R.string.friends_relationship_action_start)
        FriendRelationshipActionCenterState.READY -> stringResource(R.string.friends_relationship_action_ready)
    }

@Composable
private fun InboxSignalRow(
    item: SocialHubActionInboxItemDto,
    onClick: () -> Unit,
) {
    val title = inboxSignalTitle(item)
    val summary = inboxSignalSummary(item)
    val rowCd = stringResource(R.string.friends_relationship_inbox_signal_cd, title)
    PremiumRowSurface(
        modifier =
            Modifier
                .clickable(onClick = onClick)
                .semantics { contentDescription = rowCd },
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = summary,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (item.count > 0) {
            Text(
                text = item.count.toString(),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Icon(
            imageVector = Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun inboxSignalTitle(item: SocialHubActionInboxItemDto): String =
    when (item.type) {
        "incoming_requests" -> stringResource(R.string.friends_inbox_signal_incoming_title, item.count)
        "stale_sent_requests" -> stringResource(R.string.friends_inbox_signal_stale_sent_title, item.count)
        "privacy_review" -> stringResource(R.string.friends_inbox_signal_privacy_title, item.count)
        "relationship_controls" -> stringResource(R.string.friends_inbox_signal_relationship_title, item.count)
        "empty_circles" -> stringResource(R.string.friends_inbox_signal_empty_circles_title, item.count)
        else -> item.title.ifBlank { stringResource(R.string.friends_inbox_signal_generic_title) }
    }

@Composable
private fun inboxSignalSummary(item: SocialHubActionInboxItemDto): String =
    when (item.type) {
        "incoming_requests" -> stringResource(R.string.friends_inbox_signal_incoming_summary)
        "stale_sent_requests" -> stringResource(R.string.friends_inbox_signal_stale_sent_summary)
        "privacy_review" -> stringResource(R.string.friends_inbox_signal_privacy_summary)
        "relationship_controls" -> stringResource(R.string.friends_inbox_signal_relationship_summary)
        "empty_circles" -> stringResource(R.string.friends_inbox_signal_empty_circles_summary)
        else -> item.summary
    }

@Composable
private fun AttentionFriendRow(
    friend: FriendLiteItem,
    subtitle: String,
    onOpenFriend: (FriendLiteItem) -> Unit,
    groupLabel: String? = null,
) {
    val displayName = friend.fullName ?: friend.username ?: friend.id
    val rowCd =
        groupLabel?.let {
            stringResource(R.string.friends_relationship_action_row_cd, displayName, it)
        } ?: stringResource(R.string.friends_relationship_action_row_cd, displayName, subtitle)
    PremiumRowSurface(
        modifier =
            Modifier
                .clickable { onOpenFriend(friend) }
                .semantics { contentDescription = rowCd },
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = displayName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Icon(
            imageVector = Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
