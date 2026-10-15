/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF chat composer dock with draft attachments, reply/edit context, adaptive actions, and send state.
 *
 * Invariants:
 * - Structural mode uses zero elevation for the dock, quote banners, and field shell.
 * - Attachment and send callbacks remain identical across adaptive layouts.
 *
 * Related:
 * - ChatMessageTimeline.kt, ChatVisualStrategy.kt, ChatAttachmentSupport.kt
 */
package feature.chat

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import world.empery.mobile.core.ui.PremiumComposerFieldShape
import world.empery.mobile.core.ui.PremiumComposerShell
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumGlassShape
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.ui.shouldStackChromeActions

internal const val CHAT_COMPOSER_TAG = "gaf_chat_composer"

@Composable
internal fun ChatComposerDock(
    state: ChatUiState,
    draft: String,
    attachments: List<ChatAttachmentDraft>,
    messageById: Map<String, ChatMessageUi>,
    visual: ChatVisualStrategy,
    motion: ChatMotionPolicy,
    actions: ChatThreadActions,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    if (visual.showStructuralTimeline) {
        HorizontalDivider(
            modifier = Modifier.padding(top = 8.dp, bottom = 8.dp),
            thickness = visual.structuralLineWidth,
            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.55f),
        )
    } else {
        PremiumDividerGlow(modifier = Modifier.padding(top = 6.dp, bottom = 6.dp))
    }
    ChatComposerOuterSurface(
        structural = visual.showStructuralTimeline,
        modifier =
            modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .testTag(CHAT_COMPOSER_TAG),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.ime)
                    .padding(if (visual.showStructuralTimeline) 12.dp else 0.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (attachments.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.chat_multi_attachment_hint),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                ChatDraftAttachments(
                    attachments = attachments,
                    onRemove = actions.onRemoveAttachment,
                )
            }
            state.replyingToMessageId?.let { replyId ->
                ChatComposerContextBanner(
                    text =
                        stringResource(
                            R.string.chat_reply_banner,
                            messageById[replyId]?.body
                                ?.ifBlank { context.getString(R.string.chat_message_word) }
                                ?: context.getString(R.string.chat_message_word),
                        ),
                    contentDescription =
                        context.getString(R.string.chat_reply_banner_cd),
                    cancelDescription =
                        context.getString(R.string.chat_cancel_reply_cd),
                    structural = visual.showStructuralTimeline,
                    onCancel = actions.onCancelReply,
                )
            }
            state.editingMessageId?.let { editingId ->
                ChatComposerContextBanner(
                    text =
                        stringResource(
                            R.string.chat_edit_banner,
                            messageById[editingId]?.body
                                ?.ifBlank { context.getString(R.string.chat_message_word) }
                                ?: context.getString(R.string.chat_message_word),
                        ),
                    contentDescription =
                        context.getString(R.string.chat_edit_banner_cd),
                    cancelDescription =
                        context.getString(R.string.chat_cancel_edit_cd),
                    structural = visual.showStructuralTimeline,
                    onCancel = actions.onCancelEdit,
                )
            }
            ChatComposerInput(
                draft = draft,
                attachmentCount = attachments.size,
                structural = visual.showStructuralTimeline,
                stackActions = shouldStackChromeActions(),
                motion = motion,
                placeholderRes =
                    when {
                        state.editingMessageId != null -> R.string.chat_edit_placeholder
                        state.replyingToMessageId != null -> R.string.chat_reply_placeholder
                        else -> R.string.chat_message_placeholder
                    },
                onDraftChange = actions.onDraftChange,
                onPickImage = actions.onPickImage,
                onPickFile = actions.onPickFile,
                onSend = actions.onSend,
            )
        }
    }
}

@Composable
private fun ChatComposerOuterSurface(
    structural: Boolean,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    if (structural) {
        Surface(
            modifier = modifier,
            color = Color.Transparent,
            shape = RoundedCornerShape(0.dp),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            content = content,
        )
    } else {
        PremiumGlassCard(
            modifier = modifier,
            tonalElevation = 6.dp,
        ) {
            content()
        }
    }
}

@Composable
private fun ChatDraftAttachments(
    attachments: List<ChatAttachmentDraft>,
    onRemove: (String) -> Unit,
) {
    val context = LocalContext.current
    LazyRow(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(max = 88.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(
            items = attachments,
            key = { it.id },
            contentType = { "chat_attachment_chip" },
        ) { attachment ->
            PremiumRowSurface(
                modifier = Modifier.widthIn(max = 280.dp),
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                tonalElevation = 0.dp,
            ) {
                if (attachment.mimeType.startsWith("image/")) {
                    AsyncImage(
                        model = attachment.uri,
                        contentDescription =
                            context.getString(R.string.chat_attach_image_cd),
                        contentScale = ContentScale.Crop,
                        modifier =
                            Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(10.dp)),
                    )
                }
                Text(
                    text =
                        "${attachment.displayName} · ${attachment.mimeType.substringBefore('/')}" +
                            (attachment.sizeBytes?.let { " · ${humanReadableBytes(it)}" } ?: ""),
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.weight(1f, fill = false),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                OutlinedButton(
                    onClick = { onRemove(attachment.id) },
                    modifier =
                        Modifier
                            .defaultMinSize(minHeight = 48.dp)
                            .semantics {
                                contentDescription =
                                    context.getString(
                                        R.string.chat_remove_draft_attachment_cd,
                                        attachment.displayName,
                                    )
                            },
                ) {
                    Text(stringResource(R.string.chat_remove_draft_attachment))
                }
            }
        }
    }
}

@Composable
private fun ChatComposerContextBanner(
    text: String,
    contentDescription: String,
    cancelDescription: String,
    structural: Boolean,
    onCancel: () -> Unit,
) {
    val content: @Composable () -> Unit = {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium,
                modifier =
                    Modifier
                        .weight(1f)
                        .semantics { this.contentDescription = contentDescription },
            )
            TextButton(
                onClick = onCancel,
                modifier =
                    Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .semantics { this.contentDescription = cancelDescription },
            ) {
                Text(stringResource(R.string.chat_cancel))
            }
        }
    }
    if (structural) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color.Transparent,
            shape = RoundedCornerShape(0.dp),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            border =
                BorderStroke(
                    0.5.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                ),
            content = content,
        )
    } else {
        PremiumRowSurface(
            modifier = Modifier.fillMaxWidth(),
            content = { content() },
        )
    }
}

@Composable
private fun ChatComposerInput(
    draft: String,
    attachmentCount: Int,
    structural: Boolean,
    stackActions: Boolean,
    motion: ChatMotionPolicy,
    placeholderRes: Int,
    onDraftChange: (String) -> Unit,
    onPickImage: () -> Unit,
    onPickFile: () -> Unit,
    onSend: () -> Unit,
) {
    val field: @Composable () -> Unit = {
        ChatComposerFieldShell(structural = structural) {
            OutlinedTextField(
                value = draft,
                onValueChange = onDraftChange,
                placeholder = { Text(stringResource(placeholderRes)) },
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .then(
                            if (motion.animateContent) {
                                Modifier.animateContentSize()
                            } else {
                                Modifier
                            },
                        ),
                minLines = 1,
                maxLines = 5,
                shape = if (structural) RoundedCornerShape(0.dp) else PremiumComposerFieldShape,
                colors =
                    OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Transparent,
                        unfocusedBorderColor = Color.Transparent,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                    ),
            )
        }
    }
    val actions: @Composable () -> Unit = {
        ChatComposerActions(
            canSend = draft.isNotBlank() || attachmentCount > 0,
            attachmentCount = attachmentCount,
            onPickImage = onPickImage,
            onPickFile = onPickFile,
            onSend = onSend,
        )
    }
    if (stackActions) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            field()
            actions()
        }
    } else {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.weight(1f)) { field() }
            actions()
        }
    }
}

@Composable
private fun ChatComposerFieldShell(
    structural: Boolean,
    content: @Composable () -> Unit,
) {
    if (structural) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color.Transparent,
            shape = RoundedCornerShape(0.dp),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
            border =
                BorderStroke(
                    0.5.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                ),
            content = content,
        )
    } else {
        PremiumComposerShell(
            modifier = Modifier.fillMaxWidth(),
            content = content,
        )
    }
}

@Composable
private fun ChatComposerActions(
    canSend: Boolean,
    attachmentCount: Int,
    onPickImage: () -> Unit,
    onPickFile: () -> Unit,
    onSend: () -> Unit,
) {
    val context = LocalContext.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        BadgedBox(
            badge = {
                if (attachmentCount > 0) {
                    Badge {
                        Text(
                            stringResource(
                                R.string.chat_multi_attachment_count,
                                attachmentCount,
                                MAX_ATTACHMENTS_PER_MESSAGE,
                            ),
                        )
                    }
                }
            },
        ) {
            IconButton(
                onClick = onPickImage,
                modifier = Modifier.mobileMinimumTouchTarget(),
            ) {
                Icon(
                    Icons.Filled.Image,
                    contentDescription = context.getString(R.string.chat_attach_image_cd),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
        IconButton(
            onClick = onPickFile,
            modifier = Modifier.mobileMinimumTouchTarget(),
        ) {
            Icon(
                Icons.Outlined.AttachFile,
                contentDescription = context.getString(R.string.chat_attach_file_cd),
                tint = MaterialTheme.colorScheme.primary,
            )
        }
        FilledIconButton(
            onClick = onSend,
            enabled = canSend,
            modifier =
                Modifier
                    .mobileMinimumTouchTarget()
                    .semantics {
                        contentDescription =
                            context.getString(
                                if (canSend) {
                                    R.string.chat_send_cd
                                } else {
                                    R.string.chat_send_disabled_cd
                                },
                            )
                    },
            shape = CircleShape,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Send,
                contentDescription = null,
            )
        }
    }
}
