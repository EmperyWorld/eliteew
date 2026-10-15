/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF chat list/thread header with partner identity, unread context, calls, and destructive actions.
 *
 * Invariants:
 * - System accounts never expose call actions.
 * - Compact layouts move call actions into the overflow menu.
 *
 * Related:
 * - ChatFeature.kt, GafChatPartnerAvatar.kt, GafChatPartnerAccountBadges.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import world.empery.mobile.core.ui.shouldStackChromeActions

@Composable
internal fun ChatTopBar(
    selectedChat: ChatEntity?,
    visibleChatsCount: Int,
    unreadChatsCount: Int,
    onCloseChat: () -> Unit,
    onRequestClearHistory: () -> Unit,
    onRequestArchiveChat: () -> Unit,
    onRequestDeleteChat: () -> Unit,
    showVideoCallAction: Boolean,
    onStartVideoCall: () -> Unit,
    onStartGroupVideoCall: () -> Unit,
    modifier: Modifier = Modifier,
    listPartnerMeta: Map<String, GafChatListPartnerMeta> = emptyMap(),
    showBackNavigation: Boolean = true,
) {
    val context = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    var actionsExpanded by remember { mutableStateOf(false) }
    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        if (selectedChat == null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.chat_title),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!chrome.shouldStackChromeActions) {
                        Text(
                            text = stringResource(R.string.chat_list_subtitle, visibleChatsCount),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (unreadChatsCount > 0) {
                    PremiumBadge(
                        text = stringResource(R.string.chat_list_unread_badge, unreadChatsCount),
                    )
                }
            }
            return@PremiumGlassCard
        }

        val partnerMeta = listPartnerMeta[selectedChat.chatId] ?: GafChatListPartnerMeta()
        val showVideoInBar = showVideoCallAction && !chrome.shouldStackChromeActions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (showBackNavigation) {
                IconButton(
                    onClick = onCloseChat,
                    modifier = Modifier.mobileMinimumTouchTarget(),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = context.getString(R.string.chat_back_cd),
                    )
                }
            }
            GafChatPartnerAvatar(
                partnerName = selectedChat.partnerName,
                partnerAvatarUrl = selectedChat.partnerAvatarUrl,
                isSystemAccount = selectedChat.isSystemAccount,
                modifier = Modifier.size(36.dp),
                systemFallbackIconSize = 20.dp,
            )
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text =
                            selectedChat.partnerName
                                ?: stringResource(
                                    R.string.chat_title_with_id,
                                    shortChatId(selectedChat.chatId),
                                ),
                        style =
                            MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.SemiBold,
                            ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    GafChatPartnerAccountBadges(
                        meta = partnerMeta,
                        isSystemAccount = selectedChat.isSystemAccount,
                        compact = true,
                    )
                }
                resolveChatListPartnerSubtitle(
                    selectedChat.partnerName
                        ?: stringResource(
                            R.string.chat_title_with_id,
                            shortChatId(selectedChat.chatId),
                        ),
                    partnerMeta,
                )?.let { subtitle ->
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (showVideoInBar) {
                IconButton(
                    onClick = onStartGroupVideoCall,
                    modifier = Modifier.mobileMinimumTouchTarget(),
                ) {
                    Icon(
                        Icons.Filled.Groups,
                        contentDescription = context.getString(R.string.chat_video_call_group_cd),
                    )
                }
                IconButton(
                    onClick = onStartVideoCall,
                    modifier = Modifier.mobileMinimumTouchTarget(),
                ) {
                    Icon(
                        Icons.Filled.Videocam,
                        contentDescription = context.getString(R.string.chat_video_call_cd),
                    )
                }
            }
            Box {
                IconButton(
                    onClick = { actionsExpanded = true },
                    modifier = Modifier.mobileMinimumTouchTarget(),
                ) {
                    Icon(
                        Icons.Filled.MoreVert,
                        contentDescription = context.getString(R.string.chat_menu_cd),
                    )
                }
                DropdownMenu(
                    expanded = actionsExpanded,
                    onDismissRequest = { actionsExpanded = false },
                ) {
                    if (showVideoCallAction && chrome.shouldStackChromeActions) {
                        ChatTopBarMenuItem(
                            label = stringResource(R.string.chat_video_call_group_cd),
                            onClick = {
                                actionsExpanded = false
                                onStartGroupVideoCall()
                            },
                        )
                        ChatTopBarMenuItem(
                            label = stringResource(R.string.chat_video_call_cd),
                            onClick = {
                                actionsExpanded = false
                                onStartVideoCall()
                            },
                        )
                    }
                    ChatTopBarMenuItem(
                        label = stringResource(R.string.chat_menu_clear),
                        onClick = {
                            actionsExpanded = false
                            onRequestClearHistory()
                        },
                    )
                    ChatTopBarMenuItem(
                        label = stringResource(R.string.chat_menu_archive),
                        onClick = {
                            actionsExpanded = false
                            onRequestArchiveChat()
                        },
                    )
                    DropdownMenuItem(
                        text = {
                            Text(
                                stringResource(R.string.chat_menu_delete),
                                color = MaterialTheme.colorScheme.error,
                            )
                        },
                        onClick = {
                            actionsExpanded = false
                            onRequestDeleteChat()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatTopBarMenuItem(
    label: String,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(label) },
        onClick = onClick,
    )
}
