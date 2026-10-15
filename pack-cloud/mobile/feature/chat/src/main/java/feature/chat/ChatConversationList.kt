/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyed GAF conversation list rows, status hierarchy, and local pin/mute/archive actions.
 *
 * Invariants:
 * - Stable chat ids key every lazy item.
 * - Reduced motion removes item placement transitions without changing list behavior.
 *
 * Related:
 * - ChatListPane.kt, GafChatListPartnerPresentation.kt, ChatMotionPolicy.kt
 */
package feature.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.VolumeOff
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.core.ui.MobileEmptyState
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import world.empery.mobile.core.ui.shouldStackChromeActions

@Composable
internal fun ChatConversationList(
    chats: List<ChatEntity>,
    chatLocalFlags: Map<String, ChatLocalFlags>,
    selectedChatId: String?,
    listPartnerMeta: Map<String, GafChatListPartnerMeta>,
    masterDetailListPane: Boolean,
    showFilteredEmpty: Boolean,
    actions: ChatListActions,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    val motion = rememberChatMotionPolicy()
    val visual = LocalChatStyle.current
    val structuralList = visual.showStructuralTimeline
    val rowLayout =
        resolveGafChatListRowLayout(
            shouldStackChromeActions = chrome.shouldStackChromeActions,
            masterDetailListPane = masterDetailListPane,
        )
    if (showFilteredEmpty) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            MobileEmptyState(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .semantics(mergeDescendants = true) {
                            contentDescription = context.getString(R.string.chat_filter_empty_cd)
                        },
                title = stringResource(R.string.chat_filter_empty_title),
                message = stringResource(R.string.chat_filter_empty),
                contentDescription = context.getString(R.string.chat_filter_empty_cd),
            )
        }
        return
    }
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = 4.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(if (structuralList) 2.dp else 8.dp),
    ) {
        items(
            items = chats,
            key = { it.chatId },
            contentType = { "gaf_chat_conversation" },
        ) { chat ->
            val isSelected = chat.chatId == selectedChatId
            val flags = chatLocalFlags[chat.chatId] ?: ChatLocalFlags()
            val hasUnread = chat.unreadCount > 0
            val presentation =
                resolveChatListRowPresentation(
                    chat = chat,
                    meta = listPartnerMeta[chat.chatId],
                    displayNameFallback =
                        stringResource(R.string.chat_title_with_id, shortChatId(chat.chatId)),
                )
            val itemModifier =
                if (motion.animateItems) {
                    Modifier.animateItem()
                } else {
                    Modifier
                }
            Surface(
                modifier =
                    itemModifier
                        .fillMaxWidth()
                        .then(
                            if (isSelected && !structuralList) {
                                Modifier.border(
                                    width = 1.5.dp,
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.72f),
                                    shape = RoundedCornerShape(18.dp),
                                )
                            } else {
                                Modifier
                            },
                        ),
                shape = RoundedCornerShape(if (structuralList) 4.dp else 18.dp),
                color =
                    when {
                        structuralList && isSelected ->
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                        structuralList -> Color.Transparent
                        chat.isSystemAccount ->
                            MaterialTheme.colorScheme.primaryContainer.copy(
                                alpha = if (isSelected) 0.9f else 0.68f,
                            )
                        isSelected -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.78f)
                        else -> MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.88f)
                    },
                tonalElevation =
                    when {
                        structuralList -> 0.dp
                        isSelected || hasUnread || chat.isSystemAccount -> 3.dp
                        else -> 2.dp
                    },
                border =
                    if (structuralList) {
                        null
                    } else {
                        BorderStroke(
                            1.dp,
                            when {
                                isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.72f)
                                chat.isSystemAccount ->
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.42f)
                                else ->
                                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f)
                            },
                        )
                    },
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable { actions.onOpenChat(chat.chatId) }
                                .padding(
                                    horizontal = 12.dp,
                                    vertical = rowLayout.verticalPaddingDp.dp,
                                ),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        GafChatPartnerAvatar(
                            partnerName = chat.partnerName,
                            partnerAvatarUrl = chat.partnerAvatarUrl,
                            isSystemAccount = chat.isSystemAccount,
                            modifier = Modifier.size(rowLayout.avatarSizeDp.dp),
                            unreadCount = if (isSelected) 0 else chat.unreadCount,
                            systemFallbackIconSize = (rowLayout.avatarSizeDp * 0.58f).dp,
                        )
                        ChatConversationText(
                            chat = chat,
                            flags = flags,
                            hasUnread = hasUnread,
                            presentation = presentation,
                            titleMaxLines = rowLayout.titleMaxLines,
                            previewMaxLines = rowLayout.previewMaxLines,
                            showPartnerSubtitle = rowLayout.showPartnerSubtitle,
                        )
                    }
                    if (!chat.isSystemAccount && rowLayout.showQuickActions) {
                        if (!structuralList) {
                            HorizontalDivider(
                                modifier = Modifier.padding(horizontal = 12.dp),
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.28f),
                            )
                        }
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(start = 2.dp, end = 2.dp, bottom = 2.dp),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            ChatListQuickAction(
                                onClick = { actions.onTogglePinned(chat.chatId) },
                                active = flags.pinned,
                                icon =
                                    if (flags.pinned) {
                                        Icons.Filled.PushPin
                                    } else {
                                        Icons.Outlined.PushPin
                                    },
                                contentDescription =
                                    stringResource(
                                        if (flags.pinned) R.string.chat_unpin_cd else R.string.chat_pin_cd,
                                        shortChatId(chat.chatId),
                                    ),
                            )
                            ChatListQuickAction(
                                onClick = { actions.onToggleMuted(chat.chatId) },
                                active = flags.muted,
                                icon =
                                    if (flags.muted) {
                                        Icons.AutoMirrored.Outlined.VolumeOff
                                    } else {
                                        Icons.AutoMirrored.Outlined.VolumeUp
                                    },
                                contentDescription =
                                    stringResource(
                                        if (flags.muted) R.string.chat_unmute_cd else R.string.chat_mute_cd,
                                        shortChatId(chat.chatId),
                                    ),
                            )
                            ChatListQuickAction(
                                onClick = { actions.onToggleArchived(chat.chatId) },
                                active = flags.archived,
                                icon = Icons.Outlined.Archive,
                                contentDescription =
                                    stringResource(
                                        if (flags.archived) {
                                            R.string.chat_unarchive_cd
                                        } else {
                                            R.string.chat_archive_cd
                                        },
                                        shortChatId(chat.chatId),
                                    ),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatConversationText(
    chat: ChatEntity,
    flags: ChatLocalFlags,
    hasUnread: Boolean,
    presentation: GafChatListRowPresentation,
    titleMaxLines: Int,
    previewMaxLines: Int,
    showPartnerSubtitle: Boolean,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(if (showPartnerSubtitle) 2.dp else 4.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = presentation.displayName,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.titleSmall,
                fontWeight =
                    if (hasUnread || chat.isSystemAccount) {
                        FontWeight.SemiBold
                    } else {
                        FontWeight.Medium
                    },
                maxLines = titleMaxLines,
                overflow = TextOverflow.Ellipsis,
            )
            GafChatPartnerAccountBadges(
                meta = presentation.meta,
                isSystemAccount = chat.isSystemAccount,
                compact = true,
            )
            Text(
                text = formatChatListActivityTime(LocalContext.current, chat.lastMessageAt),
                style = MaterialTheme.typography.labelSmall,
                color =
                    if (hasUnread) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
            )
        }
        if (showPartnerSubtitle) {
            presentation.partnerSubtitle?.let { subtitle ->
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (flags.pinned) {
                Icon(
                    Icons.Filled.PushPin,
                    contentDescription = stringResource(R.string.chat_list_pinned_badge),
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
            if (flags.muted) {
                Icon(
                    Icons.AutoMirrored.Outlined.VolumeOff,
                    contentDescription =
                        stringResource(R.string.chat_mute_cd, shortChatId(chat.chatId)),
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text =
                    chat.lastMessagePreview?.trim()?.takeIf { it.isNotEmpty() }
                        ?: stringResource(R.string.chat_list_preview_empty),
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                color =
                    if (hasUnread) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                fontWeight = if (hasUnread) FontWeight.Medium else FontWeight.Normal,
                maxLines = previewMaxLines,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun ChatListQuickAction(
    onClick: () -> Unit,
    active: Boolean,
    icon: ImageVector,
    contentDescription: String,
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.mobileMinimumTouchTarget(),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(18.dp),
            tint =
                if (active) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f)
                },
        )
    }
}
