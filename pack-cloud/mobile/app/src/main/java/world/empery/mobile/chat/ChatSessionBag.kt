/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared chat session mutable caches, jobs, and helpers for W1 ChatSessionController composition.
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Composed by ChatSessionController; public API remains on ChatSessionController / MainViewModel.
 *
 * Related:
 * - ChatSessionController, MainViewModel
 */
package world.empery.mobile.chat

import feature.chat.ChatMessageUi
import feature.chat.DownloadedChatAttachment
import feature.chat.UploadedChatAttachment
import feature.chat.sortedOldestFirstForChat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withContext
import world.empery.mobile.MainUiState
import world.empery.mobile.MobileMemoryPolicy
import world.empery.mobile.R
import world.empery.mobile.core.storage.PendingSendEntity
import world.empery.mobile.di.AppContainer

internal const val USER_SEARCH_DEBOUNCE_MS = 350L
internal const val CHAT_COMPOSER_DRAFT_PERSIST_DEBOUNCE_MS = 400L
internal const val CHAT_LIST_REFRESH_DEBOUNCE_MS = 900L
internal const val CHAT_OPEN_TAIL_REFRESH_MS = 350L
internal const val CHAT_OPEN_FOLLOWUP_REFRESH_MS = 400L
internal const val CHAT_QUICK_REFRESH_MS = 300L
internal const val CHAT_IMAGE_PREVIEW_PRELOAD_DEBOUNCE_MS = 320L
internal const val CHAT_IMAGE_PREVIEW_STAGGER_MS = 42L
internal const val CHAT_IMAGE_PREVIEW_MAX_MESSAGES = 18

internal data class PendingSendPayload(
    val chatId: String,
    val body: String,
    val uploadedAttachment: UploadedChatAttachment?,
    val replyToMessageId: String?,
    /** Локальный URI картинки для превью в пузырьке pending-* (пока нет server message id). */
    val localImagePreviewUri: String? = null,
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val failedReason: String? = null,
)

/** Shell hooks ChatSessionController needs from MainViewModel. */
interface ChatSessionHost {
    fun application(): android.app.Application

    fun appString(resId: Int): String

    fun appString(resId: Int, vararg args: Any): String

    fun mainState(): MutableStateFlow<MainUiState>

    fun isAppInForeground(): Boolean

    fun connectRealtimeIfAllowed()

    fun refreshNotifications()
}

/** Shared caches/jobs for chat composition pieces (W1 slice #7). */
internal class ChatSessionBag(
    val scope: CoroutineScope,
    val container: AppContainer,
    val host: ChatSessionHost,
) {
    val mainState: MutableStateFlow<MainUiState>
        get() = host.mainState()

    val chatPageSize = 50
    var chatRefreshDebounceJob: Job? = null
    var openChatTailRefreshJob: Job? = null
    val refreshChatsMutex = Mutex()
    var openChatJob: Job? = null
    var openChatGeneration: Long = 0L
    var userSearchDebounceJob: Job? = null
    var chatDraftPersistJob: Job? = null
    val chatMessagesCache =
        object : LinkedHashMap<String, List<ChatMessageUi>>(
            MobileMemoryPolicy.CHAT_MESSAGES_CACHE_MAX_CHATS + 1,
            0.75f,
            true,
        ) {
            override fun removeEldestEntry(
                eldest: MutableMap.MutableEntry<String, List<ChatMessageUi>>?,
            ): Boolean = size > MobileMemoryPolicy.CHAT_MESSAGES_CACHE_MAX_CHATS
        }
    val downloadedAttachmentsCache = linkedMapOf<String, DownloadedChatAttachment>()
    val pendingSendPayloads = linkedMapOf<String, PendingSendPayload>()
    val chatAttachmentPreviewMutex = Mutex()
    var chatImagePreviewPreloadJob: Job? = null

    fun PendingSendPayload.toEntity(id: String): PendingSendEntity =
        PendingSendEntity(
            id = id,
            chatId = chatId,
            body = body,
            attachmentContentId = uploadedAttachment?.contentId,
            attachmentName = uploadedAttachment?.fileName,
            attachmentMimeType = uploadedAttachment?.mimeType,
            attachmentSize = uploadedAttachment?.sizeBytes,
            replyToMessageId = replyToMessageId,
            localImagePreviewUri = localImagePreviewUri,
            createdAtEpochMs = createdAtEpochMs,
            failedReason = failedReason,
        )

    fun PendingSendEntity.toPayload(): PendingSendPayload =
        PendingSendPayload(
            chatId = chatId,
            body = body,
            uploadedAttachment =
                attachmentContentId?.let { contentId ->
                    UploadedChatAttachment(
                        contentId = contentId,
                        fileName = attachmentName.orEmpty(),
                        mimeType = attachmentMimeType,
                        sizeBytes = attachmentSize,
                    )
                },
            replyToMessageId = replyToMessageId,
            localImagePreviewUri = localImagePreviewUri,
            createdAtEpochMs = createdAtEpochMs,
            failedReason = failedReason,
        )

    fun pendingPayloadToUi(
        id: String,
        payload: PendingSendPayload,
        meUserId: String?,
        restored: Boolean,
    ): ChatMessageUi =
        ChatMessageUi(
            id = id,
            senderId = meUserId,
            body = payload.body,
            createdAt = null,
            attachmentContentId = payload.uploadedAttachment?.contentId,
            attachmentName = payload.uploadedAttachment?.fileName,
            attachmentMimeType = payload.uploadedAttachment?.mimeType,
            attachmentSize = payload.uploadedAttachment?.sizeBytes,
            localAttachmentPreviewUri = payload.localImagePreviewUri,
            replyToMessageId = payload.replyToMessageId,
            isPending = !restored && payload.failedReason == null,
            isFailed = restored || payload.failedReason != null,
            failedReason =
                payload.failedReason
                    ?: if (restored) host.appString(R.string.app_chat_send_failed) else null,
        )

    fun pendingMessagesForChat(chatId: String, meUserId: String?): List<ChatMessageUi> =
        pendingSendPayloads.entries
            .filter { it.value.chatId == chatId }
            .map { (id, payload) ->
                pendingPayloadToUi(id, payload, meUserId, restored = payload.failedReason != null)
            }

    fun mergeChatMessagesDedupingById(messages: List<ChatMessageUi>): List<ChatMessageUi> {
        val seen = linkedSetOf<String>()
        val out = ArrayList<ChatMessageUi>(messages.size)
        for (msg in messages) {
            if (seen.add(msg.id)) out.add(msg)
        }
        return out
    }

    /** Сортировка и дедуп по времени вынесены с главного потока для длинных диалогов. */
    suspend fun sortChatMessages(messages: List<ChatMessageUi>): List<ChatMessageUi> {
        if (messages.size <= 1) return messages
        return withContext(Dispatchers.Default) { messages.sortedOldestFirstForChat() }
    }

    /** Cursor for paging must not use optimistic/socket-only ids. */
    fun isServerBackedMessageId(messageId: String): Boolean {
        if (messageId.isBlank()) return false
        if (messageId.startsWith("pending-")) return false
        if (messageId.startsWith("socket-")) return false
        return true
    }

    fun cancelJobsForLogout() {
        openChatJob?.cancel()
        openChatJob = null
        openChatGeneration++
        userSearchDebounceJob?.cancel()
        userSearchDebounceJob = null
        chatRefreshDebounceJob?.cancel()
        chatRefreshDebounceJob = null
        openChatTailRefreshJob?.cancel()
        openChatTailRefreshJob = null
        chatDraftPersistJob?.cancel()
        chatDraftPersistJob = null
        chatImagePreviewPreloadJob?.cancel()
        chatImagePreviewPreloadJob = null
        chatMessagesCache.clear()
        downloadedAttachmentsCache.clear()
        pendingSendPayloads.clear()
    }

    fun trimChatMessagesCacheForBackground() {
        val selected = mainState.value.chatState.selectedChatId
        if (selected == null) {
            chatMessagesCache.clear()
            return
        }
        val keep = chatMessagesCache[selected]
        chatMessagesCache.clear()
        if (keep != null) {
            chatMessagesCache[selected] = keep
        }
    }

    fun trimDownloadedAttachmentsCacheForBackground() {
        while (downloadedAttachmentsCache.size > MobileMemoryPolicy.DOWNLOADED_ATTACHMENTS_CACHE_TRIM_TO) {
            val oldest = downloadedAttachmentsCache.entries.firstOrNull()?.key ?: break
            downloadedAttachmentsCache.remove(oldest)
        }
    }
}
