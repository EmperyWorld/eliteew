/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friend row card for Social Hub «Мои друзья» with compact-friendly layout and icon action bar.
 *
 * Invariants:
 * - Quick actions use icons at all UI scales; labels live in contentDescription only.
 *
 * Related:
 * - FriendsFeature.kt, FriendsLiteScreen
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.NotificationsOff
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import world.empery.mobile.core.ui.MobileAvatarPlaceholder
import world.empery.mobile.core.ui.mobileAvatarInitials
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.LocalMobileUiScale
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.ui.PremiumChipPill
import world.empery.mobile.core.ui.PremiumGlassCard

@Composable
internal fun FriendsFriendCard(
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
    val displayName = friend.fullName ?: friend.username ?: friend.id
    val usernameText = friend.username
    val circleNames = friend.circles.map { it.name }.filter { it.isNotBlank() }
    val compact = LocalMobileUiScale.current == MobileUiScale.COMPACT
    val avatarSize = if (compact) 44.dp else 52.dp

    PremiumGlassCard(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = rowSemantics
                },
        tonalElevation = if (isFocused) 5.dp else 1.dp,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MobileAvatarPlaceholder(
                    initials = mobileAvatarInitials(displayName, usernameText),
                    imageUrl = friend.avatarUrl,
                    contentDescription = displayName,
                    modifier = Modifier.size(avatarSize),
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = displayName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!usernameText.isNullOrBlank()) {
                        Text(
                            text = usernameText,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                val detailsCd = stringResource(R.string.friends_friend_details)
                IconButton(
                    onClick = onOpenDetail,
                    enabled = actionsEnabled && !rowBusy,
                    modifier = Modifier.semantics { contentDescription = detailsCd },
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Info,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            FriendRelationshipChips(chips = friend.relationshipChips())

            if (circleNames.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    circleNames.take(if (compact) 2 else 3).forEach { circleName ->
                        PremiumChipPill(
                            text = circleName,
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f),
                            contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                        )
                    }
                    if (circleNames.size > (if (compact) 2 else 3)) {
                        PremiumChipPill(
                            text =
                                stringResource(
                                    R.string.friends_friend_circle_more,
                                    circleNames.size - if (compact) 2 else 3,
                                ),
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f),
                            contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (rowBusy) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text(
                        text = stringResource(R.string.friends_row_processing),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                FriendsFriendActionIconBar(
                    friend = friend,
                    actionsEnabled = actionsEnabled,
                    onToggleFavorite = onToggleFavorite,
                    onToggleMute = onToggleMute,
                    onToggleShareActivity = onToggleShareActivity,
                    onBlockClick = onBlockClick,
                    onReportClick = onReportClick,
                )
            }
        }
    }
}

@Composable
private fun FriendsFriendActionIconBar(
    friend: FriendLiteItem,
    actionsEnabled: Boolean,
    onToggleFavorite: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleShareActivity: () -> Unit,
    onBlockClick: () -> Unit,
    onReportClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FriendActionIconButton(
            onClick = onToggleFavorite,
            enabled = actionsEnabled,
            label =
                if (friend.isFavorite) {
                    stringResource(R.string.friends_friend_unfavorite)
                } else {
                    stringResource(R.string.friends_friend_favorite)
                },
            icon =
                if (friend.isFavorite) {
                    Icons.Filled.Star
                } else {
                    Icons.Outlined.StarBorder
                },
            tint =
                if (friend.isFavorite) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
        )
        FriendActionIconButton(
            onClick = onToggleMute,
            enabled = actionsEnabled,
            label =
                if (friend.isMuted) {
                    stringResource(R.string.friends_friend_unmute)
                } else {
                    stringResource(R.string.friends_friend_mute)
                },
            icon =
                if (friend.isMuted) {
                    Icons.Outlined.NotificationsOff
                } else {
                    Icons.Outlined.Notifications
                },
            tint =
                if (friend.isMuted) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
        )
        FriendActionIconButton(
            onClick = onToggleShareActivity,
            enabled = actionsEnabled,
            label =
                if (friend.shareActivityWithFriend) {
                    stringResource(R.string.friends_friend_hide_activity)
                } else {
                    stringResource(R.string.friends_friend_share_activity)
                },
            icon =
                if (friend.shareActivityWithFriend) {
                    Icons.Outlined.Visibility
                } else {
                    Icons.Outlined.VisibilityOff
                },
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FriendActionIconButton(
            onClick = onBlockClick,
            enabled = actionsEnabled,
            label =
                if (friend.isBlocked) {
                    stringResource(R.string.friends_friend_unblock)
                } else {
                    stringResource(R.string.friends_friend_block)
                },
            icon = Icons.Outlined.Block,
            tint =
                if (friend.isBlocked) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
        )
        FriendActionIconButton(
            onClick = onReportClick,
            enabled = actionsEnabled,
            label = stringResource(R.string.friends_friend_report),
            icon = Icons.Outlined.Flag,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun FriendActionIconButton(
    onClick: () -> Unit,
    enabled: Boolean,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: androidx.compose.ui.graphics.Color,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier =
            Modifier
                .semantics {
                    contentDescription = label
                }
                .mobileMinimumTouchTarget(),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(22.dp),
        )
    }
}
