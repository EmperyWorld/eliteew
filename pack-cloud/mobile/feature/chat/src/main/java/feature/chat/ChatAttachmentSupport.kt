/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local attachment picker validation, display metadata, and preview request helpers for GAF chat.
 *
 * Invariants:
 * - Validation keeps the existing five-file and 15 MiB limits.
 * - Pending/socket ids are never used for remote attachment requests.
 *
 * Related:
 * - ChatFeature.kt, ChatMessageAttachment.kt, ChatComposerDock.kt
 */
package feature.chat

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File

internal const val MAX_ATTACHMENTS_PER_MESSAGE = 5
internal const val MAX_ATTACHMENT_BYTES = 15L * 1024L * 1024L

internal val ALLOWED_FILE_PICKER_TYPES =
    listOf(
        "image/*",
        "video/*",
        "audio/*",
        "application/pdf",
        "text/plain",
        "application/json",
    )

internal data class AttachmentValidationResult(
    val attachment: ChatAttachmentDraft? = null,
    val error: String? = null,
)

internal fun coilDataForChatPreview(ref: String): Any =
    when {
        ref.startsWith("content:") || ref.startsWith("file:") -> Uri.parse(ref)
        ref.startsWith("/") -> File(ref)
        else -> Uri.parse(ref)
    }

internal fun validateAndBuildAttachment(
    context: Context,
    uri: Uri,
    currentCount: Int,
): AttachmentValidationResult {
    if (currentCount >= MAX_ATTACHMENTS_PER_MESSAGE) {
        return AttachmentValidationResult(
            error = context.getString(R.string.chat_attachment_limit, MAX_ATTACHMENTS_PER_MESSAGE),
        )
    }
    val contentResolver = context.contentResolver
    var mimeType = contentResolver.getType(uri).orEmpty()
    val displayName = queryDisplayName(context, uri)
    if (mimeType.isBlank()) {
        mimeType = inferDraftMimeTypeFromFileName(displayName).orEmpty()
    }
    val sizeBytes = querySize(context, uri)

    if (mimeType.isBlank()) {
        return AttachmentValidationResult(
            error = context.getString(R.string.chat_attachment_mime_unknown, displayName),
        )
    }
    if (!isAllowedMimeType(mimeType)) {
        return AttachmentValidationResult(
            error = context.getString(R.string.chat_attachment_mime_unsupported, mimeType),
        )
    }
    if (sizeBytes != null && sizeBytes > MAX_ATTACHMENT_BYTES) {
        return AttachmentValidationResult(
            error =
                context.getString(
                    R.string.chat_attachment_too_large,
                    humanReadableBytes(sizeBytes),
                    humanReadableBytes(MAX_ATTACHMENT_BYTES),
                ),
        )
    }
    return AttachmentValidationResult(
        attachment =
            ChatAttachmentDraft(
                id = "attachment-${System.currentTimeMillis()}",
                displayName = displayName,
                uri = uri.toString(),
                mimeType = mimeType,
                sizeBytes = sizeBytes,
            ),
    )
}

private fun queryDisplayName(context: Context, uri: Uri): String {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) {
                cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
            }
        }
    return uri.lastPathSegment?.substringAfterLast('/')
        ?: context.getString(R.string.chat_attachment_default_name)
}

private fun querySize(context: Context, uri: Uri): Long? {
    // OEM providers may reject descriptor metadata; the cursor SIZE query below is the safe fallback.
    runCatching {
        context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
            descriptor.statSize.takeIf { it > 0L }?.let { return it }
        }
    }
    context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)
        ?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (index >= 0 && cursor.moveToFirst()) {
                cursor.getLong(index).takeIf { it > 0L }?.let { return it }
            }
        }
    return null
}

private fun isAllowedMimeType(mimeType: String): Boolean =
    mimeType.startsWith("image/") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("audio/") ||
        mimeType in
        setOf(
            "application/pdf",
            "text/plain",
            "application/zip",
            "application/json",
        )

internal fun humanReadableBytes(bytes: Long): String {
    val kibibyte = 1024.0
    val mebibyte = kibibyte * 1024.0
    return when {
        bytes >= mebibyte -> String.format("%.1f MB", bytes / mebibyte)
        bytes >= kibibyte -> String.format("%.1f KB", bytes / kibibyte)
        else -> "$bytes B"
    }
}

internal fun canRequestAttachmentByMessageId(messageId: String): Boolean =
    messageId.isNotBlank() &&
        !messageId.startsWith("pending-") &&
        !messageId.startsWith("socket-")
