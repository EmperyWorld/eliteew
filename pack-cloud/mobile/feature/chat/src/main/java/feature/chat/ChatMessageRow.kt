/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One production GAF message row: structural identity, reply quote, body, attachments, status, and menu.
 *
 * Invariants:
 * - Standard and Elite share one message content tree; strategy tokens only alter chrome.
 * - Sender identity is direct-message only: localized "You" or the selected partner name.
 * - When [ChatVisualStrategy.showPartnerAvatar] is on, partner avatar is left of theirs and
 *   self avatar is right of mine (spacer when grouped with previous).
 * - Structural message and reply surfaces have zero tonal and shadow elevation.
 *
 * Related:
 * - ChatMessageTimeline.kt, ChatMessageVisualChrome.kt, ChatMessageAttachment.kt
 */
package feature.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.LocalChatTypography

private val ChatMessageActionPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp)

@Composable
internal fun ChatMessageRow(
    message: ChatMessageUi,
    repliedMessage: ChatMessageUi?,
    visual: ChatVisualStrategy,
    isMine: Boolean,
    isGroupedWithPrevious: Boolean,
    isReadByPartner: Boolean,
    selectedChatId: String?,
    partnerName: String?,
    partnerAvatarUrl: String?,
    partnerIsSystemAccount: Boolean,
    meDisplayName: String?,
    meAvatarUrl: String?,
    bubbleMaxWidth: Dp,
    previewUri: String?,
    attachmentLoading: Boolean,
    onJumpToReply: () -> Unit,
    actions: ChatThreadActions,
    modifier: Modifier = Modifier,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val clipboard = LocalClipboardManager.current
    var menuExpanded by remember(message.id) { mutableStateOf(false) }
    val showPartnerAvatar =
        visual.showPartnerAvatar && !isMine && !isGroupedWithPrevious
    val showSelfAvatar =
        visual.showPartnerAvatar && isMine && !isGroupedWithPrevious
    // Structural identity: avatar aligns to the first line (name), not the bubble bottom.
    val avatarVerticalAlignment =
        if (visual.showStructuralTimeline) Alignment.Top else Alignment.Bottom
    val avatarTopPad = if (visual.showStructuralTimeline) 2.dp else 0.dp

    Row(
        horizontalArrangement = Arrangement.spacedBy(visual.avatarRowSpacing),
        verticalAlignment = avatarVerticalAlignment,
        modifier = modifier,
    ) {
        if (showPartnerAvatar) {
            GafChatPartnerAvatar(
                partnerName = partnerName,
                partnerAvatarUrl = partnerAvatarUrl,
                isSystemAccount = partnerIsSystemAccount,
                modifier =
                    Modifier
                        .padding(top = avatarTopPad)
                        .size(visual.avatarSize)
                        .testTag(CHAT_PARTNER_AVATAR_TAG),
                systemFallbackIconSize = (visual.avatarSize.value * 0.58f).dp,
            )
        } else if (!isMine && visual.showPartnerAvatar) {
            Spacer(modifier = Modifier.size(visual.avatarSize))
        }
        Box {
            ChatMessageVisualChrome(
                strategy = visual,
                isMine = isMine,
                isGroupedWithPrev = isGroupedWithPrevious,
                maxWidth = bubbleMaxWidth,
                onLongClick = {
                    if (!message.isPending && !message.isDeleted) {
                        menuExpanded = true
                    }
                },
            ) {
                if (visual.showSenderLabel && !isGroupedWithPrevious) {
                    Text(
                        text =
                            if (isMine) {
                                stringResource(R.string.chat_sender_you)
                            } else {
                                partnerName?.takeIf { it.isNotBlank() }
                                    ?: stringResource(R.string.chat_partner_unknown)
                            },
                        style =
                            MaterialTheme.typography.labelLarge.copy(
                                fontWeight = visual.senderLabelFontWeight,
                                letterSpacing = visual.senderLabelLetterSpacing,
                            ),
                        color =
                            if (isMine) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                        modifier = Modifier.padding(bottom = visual.senderLabelBottomPadding),
                    )
                }
                if (repliedMessage != null) {
                    ChatReplyQuote(
                        repliedMessage = repliedMessage,
                        visual = visual,
                        onClick = onJumpToReply,
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                }
                ChatMessageBody(
                    message = message,
                    visual = visual,
                    isMine = isMine,
                )
                ChatMessageAttachment(
                    message = message,
                    selectedChatId = selectedChatId,
                    previewUri = previewUri,
                    isLoading = attachmentLoading,
                    onOpenAttachment = actions.onOpenAttachment,
                    onDownloadAttachment = actions.onDownloadAttachment,
                    onLoadAttachmentPreview = actions.onLoadAttachmentPreview,
                    modifier = Modifier.padding(top = 4.dp),
                )
                if (message.isFailed) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text =
                                message.failedReason
                                    ?: stringResource(R.string.chat_send_failed),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(
                            onClick = { actions.onCancelMessage(message.id) },
                            contentPadding = ChatMessageActionPadding,
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                        ) {
                            Text(stringResource(R.string.chat_cancel))
                        }
                        TextButton(
                            onClick = { actions.onRetryMessage(message.id) },
                            contentPadding = ChatMessageActionPadding,
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                        ) {
                            Text(stringResource(R.string.chat_retry))
                        }
                    }
                } else if (message.isPending) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = stringResource(R.string.chat_sending),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(
                            onClick = { actions.onCancelMessage(message.id) },
                            contentPadding = ChatMessageActionPadding,
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                        ) {
                            Text(stringResource(R.string.chat_cancel_send))
                        }
                    }
                }
                if (!message.isPending && !message.createdAt.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text =
                            buildString {
                                append(formatChatMessageTimestamp(message.createdAt))
                                if (!message.editedAt.isNullOrBlank()) {
                                    append(context.getString(R.string.chat_message_meta_edited))
                                }
                                if (isReadByPartner) {
                                    append(context.getString(R.string.chat_message_meta_read))
                                }
                            },
                        modifier = Modifier.align(if (isMine) Alignment.End else Alignment.Start),
                        style = MaterialTheme.typography.labelSmall,
                        color =
                            when {
                                !visual.showBubbleSurface ->
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.9f)
                                isMine ->
                                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.78f)
                                else ->
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.84f)
                            },
                    )
                }
            }
            DropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = { menuExpanded = false },
            ) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.chat_reply_cd)) },
                    onClick = {
                        menuExpanded = false
                        actions.onStartReply(message.id)
                    },
                )
                if (isMine && !message.isE2ee && message.body.isNotBlank()) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.chat_edit_cd)) },
                        onClick = {
                            menuExpanded = false
                            actions.onStartEdit(message.id)
                        },
                    )
                }
                if (!message.isE2ee && message.body.isNotBlank()) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.chat_copy_message)) },
                        onClick = {
                            menuExpanded = false
                            clipboard.setText(AnnotatedString(message.body))
                        },
                    )
                }
                if (isMine) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                stringResource(R.string.chat_delete_message_cd),
                                color = MaterialTheme.colorScheme.error,
                            )
                        },
                        onClick = {
                            menuExpanded = false
                            actions.onDeleteMessage(message.id)
                        },
                    )
                }
            }
        }
        if (showSelfAvatar) {
            GafChatPartnerAvatar(
                partnerName = meDisplayName ?: stringResource(R.string.chat_sender_you),
                partnerAvatarUrl = meAvatarUrl,
                isSystemAccount = false,
                modifier =
                    Modifier
                        .padding(top = avatarTopPad)
                        .size(visual.avatarSize)
                        .testTag(CHAT_SELF_AVATAR_TAG),
                systemFallbackIconSize = (visual.avatarSize.value * 0.58f).dp,
                avatarContentDescription = stringResource(R.string.chat_sender_you),
            )
        } else if (isMine && visual.showPartnerAvatar) {
            Spacer(modifier = Modifier.size(visual.avatarSize))
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChatReplyQuote(
    repliedMessage: ChatMessageUi,
    visual: ChatVisualStrategy,
    onClick: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Surface(
        color =
            if (visual.showBubbleSurface) {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.88f)
            } else {
                Color.Transparent
            },
        shape = if (visual.showBubbleSurface) RoundedCornerShape(14.dp) else RoundedCornerShape(0.dp),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
        border =
            if (visual.showBubbleSurface) {
                null
            } else {
                BorderStroke(
                    visual.structuralLineWidth,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                )
            },
        modifier =
            Modifier
                .fillMaxWidth()
                .combinedClickable(
                    onClick = onClick,
                    onLongClick = {},
                ),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier =
                    Modifier
                        .width(if (visual.showBubbleSurface) 3.dp else visual.structuralLineWidth)
                        .heightIn(min = 36.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.72f)),
            )
            Text(
                text =
                    stringResource(
                        R.string.chat_reply_prefix,
                        when {
                            repliedMessage.isDeleted ->
                                stringResource(R.string.chat_message_deleted_word)
                            else ->
                                repliedMessage.body.ifBlank {
                                    stringResource(R.string.chat_message_word)
                                }
                        },
                    ),
                modifier =
                    Modifier
                        .weight(1f)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                        .semantics {
                            contentDescription =
                                context.getString(R.string.chat_reply_jump_cd)
                        },
                style = MaterialTheme.typography.labelSmall,
                maxLines = 2,
            )
        }
    }
}

@Composable
private fun ChatMessageBody(
    message: ChatMessageUi,
    visual: ChatVisualStrategy,
    isMine: Boolean,
) {
    val typography = LocalChatTypography.current
    val bodyStyle = typography.applyTo(visual.bodyTextStyle())
    val bodyColor = typography.resolveBodyColor(isMine, visual.showBubbleSurface)
    when {
        message.isDeleted -> {
            Text(
                text = stringResource(R.string.chat_message_deleted),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        message.isE2ee -> {
            val encryptedLabel = stringResource(R.string.chat_e2ee_unsupported_message)
            val decryptFailed = message.body.isBlank() || message.body == encryptedLabel
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Outlined.Lock,
                        contentDescription = stringResource(R.string.chat_e2ee_lock_cd),
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.tertiary,
                    )
                    Text(
                        text = if (decryptFailed) encryptedLabel else message.body,
                        style = bodyStyle,
                        color = bodyColor,
                    )
                }
                if (decryptFailed) {
                    Text(
                        text = stringResource(R.string.chat_e2ee_decrypt_hint),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        message.body.isNotBlank() -> {
            Text(
                text = message.body,
                style = bodyStyle,
                color = bodyColor,
            )
        }
    }
}
