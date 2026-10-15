/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat Lite UI models, filters, and attachment helpers.
 *
 * Invariants:
 * - Filter tab labels resolve via string resources (`labelRes`), not hardcoded locale text.
 *
 * Related:
 * - ChatFeature.kt, ChatRepository
 */
package feature.chat

import android.net.Uri

import android.content.Context
import java.util.Locale
import java.util.UUID
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

import world.empery.mobile.core.storage.ChatEntity

data class ChatLocalFlags(
    val pinned: Boolean = false,
    val muted: Boolean = false,
    val archived: Boolean = false,
)

enum class ChatListFilterTab(@androidx.annotation.StringRes val labelRes: Int) {
    All(R.string.chat_filter_all),
    Unread(R.string.chat_filter_unread),
    Pinned(R.string.chat_filter_pinned),
    Muted(R.string.chat_filter_muted),
    Archived(R.string.chat_filter_archived),
}

data class ChatAttachmentDraft(
    val id: String,
    val displayName: String,
    val uri: String,
    val mimeType: String,
    val sizeBytes: Long?,
)

data class UploadedChatAttachment(
    val contentId: String,
    val fileName: String,
    val mimeType: String?,
    val sizeBytes: Long?,
)

data class DownloadedChatAttachment(
    val uri: Uri,
    val mimeType: String,
    val fileName: String,
    /** Локальный путь (внутреннее хранилище приложения); для Coil надёжнее, чем content:// FileProvider. */
    val absolutePath: String,
)

data class ChatMessageUi(
    val id: String,
    val senderId: String?,
    val body: String,
    val createdAt: String?,
    val attachmentContentId: String? = null,
    val attachmentName: String? = null,
    val attachmentMimeType: String? = null,
    val attachmentSize: Long? = null,
    /** Локальный content:// для превью исходящего сообщения пока id ещё pending-* (скачать по API нельзя). */
    val localAttachmentPreviewUri: String? = null,
    val editedAt: String? = null,
    val replyToMessageId: String? = null,
    val isDeleted: Boolean = false,
    val isPending: Boolean = false,
    val isFailed: Boolean = false,
    val failedReason: String? = null,
    val isE2ee: Boolean = false,
    /** Serialized GAF metadata JSON for structured system messages (video call events, onboarding, etc.). */
    val metadataJson: String? = null,
    val systemPresentation: GafMessageSystemPresentation? = null,
)

data class ChatUserSearchUi(
    val id: String,
    val username: String,
    val displayName: String,
    val avatarUrl: String?,
)

/** GAF Chat E2EE mutual-consent state for the open thread toolbar. */
data class GafE2eeConsentUi(
    val chatId: String? = null,
    val status: String = "off",
    val ready: Boolean = false,
    val requestedByUserId: String? = null,
    val busy: Boolean = false,
)

data class ChatUiState(
    val chats: List<ChatEntity> = emptyList(),
    val chatLocalFlags: Map<String, ChatLocalFlags> = emptyMap(),
    val meUserId: String? = null,
    val chatFilter: String = "",
    val activeFilterTab: ChatListFilterTab = ChatListFilterTab.All,
    val selectedChatId: String? = null,
    val selectedChatUnreadBeforeOpen: Int = 0,
    val selectedChatPartnerLastReadMessageId: String? = null,
    val selectedChatMessages: List<ChatMessageUi> = emptyList(),
    val hasMoreMessages: Boolean = false,
    val isLoadingOlderMessages: Boolean = false,
    val attachmentPreviewUris: Map<String, String> = emptyMap(),
    val attachmentLoadingIds: Set<String> = emptySet(),
    val composerDrafts: Map<String, String> = emptyMap(),
    val replyingToMessageId: String? = null,
    val editingMessageId: String? = null,
    val userSearchQuery: String = "",
    val userSearchResults: List<ChatUserSearchUi> = emptyList(),
    val isSearchingUsers: Boolean = false,
    val isLoading: Boolean = false,
    val isMessagesLoading: Boolean = false,
    val operationHint: String? = null,
    val error: String? = null,
    val e2eeConsent: GafE2eeConsentUi = GafE2eeConsentUi(),
)

/** ISO-8601 sort key for chat list recency (newest first when used with descending compare). */
fun chatListActivitySortKey(lastMessageAt: String?): String =
    lastMessageAt?.trim()?.takeIf { it.isNotEmpty() } ?: ""

/** Resolves system-account flag from API payload with legacy username fallback. */
fun resolveChatPartnerIsSystemAccount(
    isSystemAccount: Boolean,
    username: String?,
): Boolean = isSystemAccount || username.equals("elite_system", ignoreCase = true)

/**
 * Chat list order: system account first, pinned, then last activity (newest on top), unread tiebreaker.
 */
fun List<ChatEntity>.sortedForChatList(
    localFlags: Map<String, ChatLocalFlags>,
): List<ChatEntity> =
    sortedWith(
        compareByDescending<ChatEntity> { it.isSystemAccount }
            .thenByDescending { localFlags[it.chatId]?.pinned == true }
            .thenByDescending { chatListActivitySortKey(it.lastMessageAt) }
            .thenByDescending { it.unreadCount }
            .thenBy { it.chatId },
    )

private fun parseChatListInstant(raw: String?): Instant? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    return runCatching { OffsetDateTime.parse(trimmed).toInstant() }
        .getOrElse { runCatching { Instant.parse(trimmed) }.getOrNull() }
}

/** Relative/short timestamp for chat list row (locale-aware). */
fun formatChatListActivityTime(
    context: Context,
    lastMessageAt: String?,
    zone: ZoneId = ZoneId.systemDefault(),
    now: Instant = Instant.now(),
): String {
    val instant = parseChatListInstant(lastMessageAt)
    if (instant == null) {
        return if (lastMessageAt.isNullOrBlank()) {
            context.getString(R.string.chat_list_time_unknown)
        } else {
            lastMessageAt.take(16)
        }
    }
    val zNow = now.atZone(zone)
    val zThen = instant.atZone(zone)
    val minutes = ChronoUnit.MINUTES.between(instant, now).coerceAtLeast(0)
    val hours = ChronoUnit.HOURS.between(instant, now).coerceAtLeast(0)
    val days = ChronoUnit.DAYS.between(zThen.toLocalDate(), zNow.toLocalDate())

    return when {
        minutes < 1 -> context.getString(R.string.chat_list_time_just_now)
        minutes < 60 -> context.getString(R.string.chat_list_time_minutes_ago, minutes.toInt())
        hours < 24 && days == 0L -> context.getString(R.string.chat_list_time_hours_ago, hours.toInt())
        days == 1L -> {
            val time = DateTimeFormatter.ofPattern("HH:mm").format(zThen)
            context.getString(R.string.chat_list_time_yesterday, time)
        }
        days == 0L -> DateTimeFormatter.ofPattern("HH:mm").format(zThen)
        else -> {
            val fmt = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT, FormatStyle.SHORT)
            zThen.format(fmt)
        }
    }
}

/**
 * GAF API returns messages `ORDER BY created_at DESC` (newest first). UI and pagination need
 * chronological order: oldest at index 0, newest last. Pending outbound messages sort last.
 */
fun List<ChatMessageUi>.sortedOldestFirstForChat(): List<ChatMessageUi> =
    distinctBy { it.id }.sortedWith(
        compareBy<ChatMessageUi> { it.isPending }
            .thenBy { msg ->
                msg.createdAt?.trim()?.takeIf { it.isNotEmpty() } ?: "\u0000"
            }
            .thenBy { it.id },
    )

/**
 * When the API omits [attachment_mime_type], infer a displayable image MIME from the filename
 * (older rows sometimes lack MIME) so previews can still be scheduled.
 */
fun inferImageMimeTypeFromFileName(fileName: String?): String? {
    val ext =
        fileName
            ?.substringAfterLast('.', "")
            ?.lowercase()
            .orEmpty()
            .trim()
    if (ext.isBlank()) return null
    return when (ext) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "heic", "heif" -> "image/heic"
        "bmp" -> "image/bmp"
        else -> null
    }
}

/**
 * Когда ContentResolver не отдал MIME (типично для части URI с галерей OEM), достраиваем по имени файла
 * для тех же типов, что разрешены в композере вложений.
 */
fun inferDraftMimeTypeFromFileName(fileName: String?): String? {
    if (fileName.isNullOrBlank()) return null
    inferImageMimeTypeFromFileName(fileName)?.let { return it }
    val ext = fileName.substringAfterLast('.', "").lowercase().trim()
    if (ext.isBlank()) return null
    return when (ext) {
        "pdf" -> "application/pdf"
        "txt" -> "text/plain"
        "json" -> "application/json"
        "zip" -> "application/zip"
        "mp4", "m4v", "webm", "mkv" -> "video/mp4"
        "mp3", "m4a", "aac" -> "audio/mpeg"
        "ogg", "opus" -> "audio/ogg"
        else -> null
    }
}

/** Согласовать MIME для превью картинок: API/socket может отдать пустой тип при известном имени файла. */
fun resolveChatAttachmentMimeType(mime: String?, fileName: String?): String? {
    val m = sanitizeGafOptionalString(mime)
    if (m != null) return m
    return inferImageMimeTypeFromFileName(sanitizeGafOptionalString(fileName))
}

private val GAF_SENTINEL_NULL_STRINGS =
    setOf("null", "undefined", "none", "(null)", "nil")

/** Drop blank and JSON/JS sentinel strings that must not surface in chat UI. */
fun sanitizeGafOptionalString(raw: String?): String? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isBlank()) return null
    if (trimmed.lowercase(Locale.ROOT) in GAF_SENTINEL_NULL_STRINGS) return null
    return trimmed
}

/** Only real unified_content UUIDs are downloadable; reject literal "null" and junk ids. */
fun sanitizeGafAttachmentContentId(raw: String?): String? {
    val trimmed = sanitizeGafOptionalString(raw) ?: return null
    return runCatching {
        UUID.fromString(trimmed)
        trimmed
    }.getOrNull()
}

/** True when the message carries attachment metadata the client can safely render or fetch. */
fun hasRenderableChatAttachment(
    attachmentContentId: String?,
    attachmentMimeType: String?,
    attachmentName: String?,
    attachmentSize: Long? = null,
): Boolean {
    if (sanitizeGafAttachmentContentId(attachmentContentId) == null) return false
    val mime = resolveChatAttachmentMimeType(attachmentMimeType, attachmentName)
    val name = sanitizeGafOptionalString(attachmentName)
    return mime != null || name != null || (attachmentSize != null && attachmentSize > 0L)
}

/** Whether an attachment should show an in-chat image preview (Coil) vs file actions only. */

enum class ChatAttachmentPreviewKind {
    Image,
    Pdf,
    Audio,
    Unknown,
}

/** Classify attachment for in-thread preview affordance (image inline vs file chip). */
fun classifyChatAttachmentPreviewKind(
    attachmentMimeType: String?,
    attachmentName: String?,
    attachmentContentId: String?,
): ChatAttachmentPreviewKind {
    if (!hasRenderableChatAttachment(attachmentContentId, attachmentMimeType, attachmentName)) {
        return ChatAttachmentPreviewKind.Unknown
    }
    val mime = resolveChatAttachmentMimeType(attachmentMimeType, attachmentName).orEmpty()
    return when {
        mime.startsWith("image/") -> ChatAttachmentPreviewKind.Image
        mime == "application/pdf" || attachmentName.orEmpty().endsWith(".pdf", ignoreCase = true) ->
            ChatAttachmentPreviewKind.Pdf
        mime.startsWith("audio/") -> ChatAttachmentPreviewKind.Audio
        else -> ChatAttachmentPreviewKind.Unknown
    }
}

/** True only for executable/installer-style attachments (confirm on open, not inline in bubble). */
fun shouldShowSafeContentWarning(
    attachmentMimeType: String?,
    attachmentName: String?,
): Boolean {
    val ext = attachmentName?.substringAfterLast('.', "")?.lowercase().orEmpty()
    val riskyExt = setOf("apk", "exe", "bat", "cmd", "scr", "js", "jar", "dex")
    if (ext in riskyExt) return true
    val mime = resolveChatAttachmentMimeType(attachmentMimeType, attachmentName).orEmpty()
    return mime in setOf("application/vnd.android.package-archive", "application/x-msdownload")
}

data class GafChatMergeResult(
    val messages: List<ChatMessageUi>,
    val removedPendingId: String? = null,
    val skippedDuplicate: Boolean = false,
)

/**
 * Merge `gaf_chat.message_new` into an open thread: skip duplicate ids, replace optimistic pending
 * outbound rows, otherwise append. Pure helper for UI + unit tests (socket reconnect dedup).
 */
fun mergeGafChatMessageNew(
    existing: List<ChatMessageUi>,
    incoming: ChatMessageUi,
    isMine: Boolean,
): GafChatMergeResult {
    if (existing.any { it.id == incoming.id }) {
        return GafChatMergeResult(existing, skippedDuplicate = true)
    }
    val optimisticMatch =
        if (isMine) {
            existing.firstOrNull { msg ->
                msg.isPending &&
                    msg.body == incoming.body &&
                    msg.attachmentContentId == incoming.attachmentContentId
            }
        } else {
            null
        }
    val merged =
        if (optimisticMatch != null) {
            existing.map { msg -> if (msg.id == optimisticMatch.id) incoming else msg }
        } else {
            existing + incoming
        }
    return GafChatMergeResult(
        messages = merged.sortedOldestFirstForChat(),
        removedPendingId = optimisticMatch?.id,
    )
}

fun isImageAttachmentForPreview(
    attachmentContentId: String?,
    attachmentMimeType: String?,
    attachmentName: String?,
): Boolean {
    if (!hasRenderableChatAttachment(attachmentContentId, attachmentMimeType, attachmentName)) return false
    val mime = resolveChatAttachmentMimeType(attachmentMimeType, attachmentName)
    return mime?.startsWith("image/") == true
}
