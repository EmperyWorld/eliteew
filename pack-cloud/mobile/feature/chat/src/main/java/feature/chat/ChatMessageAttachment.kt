/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders one GAF message attachment: local pending preview, cached image, or remote file actions.
 *
 * Invariants:
 * - Pending/socket ids never invoke remote open, download, or preview callbacks.
 * - Image requests use bounded Coil sizes and disabled hardware bitmaps for OEM stability.
 *
 * Related:
 * - ChatMessageRow.kt, ChatAttachmentSupport.kt, ChatModels.kt
 */
package feature.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.InsertDriveFile
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import coil.compose.AsyncImage
import coil.request.ImageRequest
import coil.size.Size

@Composable
internal fun ChatMessageAttachment(
    message: ChatMessageUi,
    selectedChatId: String?,
    previewUri: String?,
    isLoading: Boolean,
    onOpenAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    onDownloadAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    onLoadAttachmentPreview: (chatId: String, messageId: String, fileName: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (
        message.isDeleted ||
        !hasRenderableChatAttachment(
            message.attachmentContentId,
            message.attachmentMimeType,
            message.attachmentName,
            message.attachmentSize,
        )
    ) {
        return
    }
    val context = LocalContext.current
    val previewKind =
        classifyChatAttachmentPreviewKind(
            message.attachmentMimeType,
            message.attachmentName,
            message.attachmentContentId,
        )
    val isImage = previewKind == ChatAttachmentPreviewKind.Image
    val chatId = selectedChatId.orEmpty()
    val canUseRemote =
        chatId.isNotBlank() &&
            canRequestAttachmentByMessageId(message.id) &&
            !message.isPending

    androidx.compose.foundation.layout.Column(modifier = modifier.fillMaxWidth()) {
        if (!isImage) {
            val (icon, descriptionRes) =
                when (previewKind) {
                    ChatAttachmentPreviewKind.Pdf ->
                        Icons.Outlined.Description to R.string.chat_attachment_pdf_cd
                    ChatAttachmentPreviewKind.Audio ->
                        Icons.Outlined.AudioFile to R.string.chat_attachment_audio_cd
                    else ->
                        Icons.AutoMirrored.Outlined.InsertDriveFile to
                            R.string.chat_attachment_unknown_cd
                }
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    icon,
                    contentDescription = context.getString(descriptionRes),
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text =
                        message.attachmentName
                            ?: stringResource(R.string.chat_attachment_default_name),
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (
            shouldShowSafeContentWarning(
                message.attachmentMimeType,
                message.attachmentName,
            )
        ) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .semantics(mergeDescendants = true) {
                            contentDescription =
                                context.getString(R.string.chat_safe_content_warning_cd)
                        },
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    stringResource(R.string.chat_safe_content_warning),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
        when {
            isImage &&
                message.isPending &&
                !message.localAttachmentPreviewUri.isNullOrBlank() -> {
                ChatAttachmentImage(
                    ref = message.localAttachmentPreviewUri.orEmpty(),
                    contentDescription =
                        context.getString(R.string.chat_outgoing_image_sending_cd),
                )
                Text(
                    text = stringResource(R.string.chat_sending),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            isImage && !previewUri.isNullOrBlank() && canUseRemote -> {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(160.dp),
                ) {
                    ChatAttachmentImage(
                        ref = previewUri,
                        contentDescription =
                            context.getString(R.string.chat_attachment_image_cd),
                        modifier =
                            Modifier.clickable {
                                onOpenAttachment(
                                    chatId,
                                    message.id,
                                    message.attachmentName,
                                )
                            },
                    )
                    IconButton(
                        onClick = {
                            onDownloadAttachment(
                                chatId,
                                message.id,
                                message.attachmentName,
                            )
                        },
                        enabled = !isLoading,
                        modifier =
                            Modifier
                                .align(Alignment.BottomEnd)
                                .padding(6.dp)
                                .size(40.dp)
                                .zIndex(2f)
                                .background(Color.Black.copy(alpha = 0.45f), CircleShape),
                    ) {
                        Icon(
                            Icons.Outlined.FileDownload,
                            contentDescription =
                                context.getString(R.string.chat_download_attachment_cd),
                            tint = Color.White,
                        )
                    }
                }
            }
            canUseRemote -> {
                if (isImage && previewUri.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier =
                                    Modifier
                                        .size(16.dp)
                                        .semantics {
                                            contentDescription =
                                                context.getString(
                                                    R.string.chat_preview_loading_cd,
                                                )
                                        },
                                strokeWidth = 2.dp,
                            )
                            Text(
                                stringResource(R.string.chat_preview_loading),
                                style = MaterialTheme.typography.labelSmall,
                            )
                        } else {
                            Text(
                                stringResource(R.string.chat_preview_preparing),
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(
                        onClick = {
                            onOpenAttachment(
                                chatId,
                                message.id,
                                message.attachmentName,
                            )
                        },
                        enabled = !isLoading,
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.OpenInNew,
                            contentDescription =
                                context.getString(R.string.chat_open_attachment_cd),
                        )
                    }
                    IconButton(
                        onClick = {
                            onDownloadAttachment(
                                chatId,
                                message.id,
                                message.attachmentName,
                            )
                        },
                        enabled = !isLoading,
                    ) {
                        Icon(
                            Icons.Outlined.FileDownload,
                            contentDescription =
                                context.getString(R.string.chat_download_attachment_cd),
                        )
                    }
                    if (isImage && previewUri.isNullOrBlank()) {
                        IconButton(
                            onClick = {
                                onLoadAttachmentPreview(
                                    chatId,
                                    message.id,
                                    message.attachmentName,
                                )
                            },
                            enabled = !isLoading,
                        ) {
                            Icon(
                                Icons.Outlined.Refresh,
                                contentDescription =
                                    context.getString(R.string.chat_refresh_preview_cd),
                            )
                        }
                    }
                }
            }
            else -> {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.chat_attachment_after_send),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ChatAttachmentImage(
    ref: String,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val request =
        ImageRequest.Builder(context)
            .data(coilDataForChatPreview(ref))
            .allowHardware(false)
            .crossfade(true)
            .size(Size(320, 320))
            .build()
    AsyncImage(
        model = request,
        contentDescription = contentDescription,
        contentScale = ContentScale.Crop,
        modifier =
            modifier
                .fillMaxWidth()
                .height(160.dp)
                .clip(RoundedCornerShape(18.dp)),
    )
}
