/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat attachment download/open/preview IO for GAF messages (W1 composition piece).
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Composed by ChatSessionController; public API remains on ChatSessionController / MainViewModel.
 *
 * Related:
 * - ChatSessionController, ChatSessionBag, MainViewModel
 */
package world.empery.mobile.chat

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import feature.chat.DownloadedChatAttachment
import feature.chat.hasRenderableChatAttachment
import feature.chat.isImageAttachmentForPreview
import java.io.FileInputStream
import java.io.InputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry

internal class ChatAttachmentIo(
    private val bag: ChatSessionBag,
) {
    fun openAttachment(chatId: String, messageId: String, fileName: String?): Job = bag.scope.launch {
        if (!bag.mainState.value.isAuthenticated) return@launch
        if (!canRequestAttachment(messageId)) {
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = bag.host.appString(R.string.app_chat_attachment_pending),
                    ),
                )
            }
            return@launch
        }
        runCatching {
            fetchAttachment(
                chatId = chatId,
                messageId = messageId,
                fileName = fileName,
                allowRecipientAcceptFallback = allowRecipientAcceptFallbackForMessage(messageId),
            )
        }.onSuccess { downloaded ->
            runCatching {
                val openIntent =
                    Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(downloaded.uri, downloaded.mimeType)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                bag.host.application().startActivity(openIntent)
            }.onFailure { err ->
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = err.message ?: bag.host.appString(R.string.app_chat_open_attachment_failed),
                        ),
                    )
                }
            }
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "downloadAttachment failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_download_attachment_failed),
                    ),
                )
            }
        }
    }

    fun downloadAttachmentToDevice(chatId: String, messageId: String, fileName: String?): Job =
        bag.scope.launch {
            if (!bag.mainState.value.isAuthenticated) return@launch
            if (!canRequestAttachment(messageId)) {
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = bag.host.appString(R.string.app_chat_file_not_confirmed),
                        ),
                    )
                }
                return@launch
            }
            runCatching {
                val downloaded =
                    fetchAttachment(
                        chatId = chatId,
                        messageId = messageId,
                        fileName = fileName,
                        allowRecipientAcceptFallback = allowRecipientAcceptFallbackForMessage(messageId),
                    )
                withContext(Dispatchers.IO) { saveAttachmentToDownloads(downloaded) }
                downloaded
            }.onSuccess {
                bag.mainState.update { it.copy(chatState = it.chatState.copy(error = null)) }
                val app = bag.host.application()
                Toast.makeText(
                    app,
                    bag.host.appString(R.string.app_chat_file_saved_downloads),
                    Toast.LENGTH_LONG,
                ).show()
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "downloadAttachmentToDevice failed")
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = err.message ?: bag.host.appString(R.string.app_chat_save_attachment_failed),
                        ),
                    )
                }
            }
        }

    fun loadAttachmentPreview(chatId: String, messageId: String, fileName: String?): Job =
        bag.scope.launch {
            loadAttachmentPreviewSuspend(chatId, messageId, fileName)
        }

    fun scheduleChatImagePreviewPreloads() {
        bag.chatImagePreviewPreloadJob?.cancel()
        bag.chatImagePreviewPreloadJob = bag.scope.launch {
            delay(CHAT_IMAGE_PREVIEW_PRELOAD_DEBOUNCE_MS)
            val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
            val messages = bag.mainState.value.chatState.selectedChatMessages
            val previews = bag.mainState.value.chatState.attachmentPreviewUris
            val loading = bag.mainState.value.chatState.attachmentLoadingIds
            val candidates =
                messages.asReversed()
                    .asSequence()
                    .filter { msg ->
                        !msg.isDeleted &&
                            hasRenderableChatAttachment(
                                msg.attachmentContentId,
                                msg.attachmentMimeType,
                                msg.attachmentName,
                                msg.attachmentSize,
                            ) &&
                            isImageAttachmentForPreview(
                                msg.attachmentContentId,
                                msg.attachmentMimeType,
                                msg.attachmentName,
                            ) &&
                            canRequestAttachment(msg.id) &&
                            !msg.isPending &&
                            msg.id !in previews &&
                            msg.id !in loading
                    }
                    .distinctBy { it.id }
                    .take(CHAT_IMAGE_PREVIEW_MAX_MESSAGES)
                    .toList()
            candidates.forEachIndexed { index, msg ->
                if (!isActive) return@launch
                if (bag.mainState.value.chatState.selectedChatId != chatId) return@launch
                if (index > 0) delay(CHAT_IMAGE_PREVIEW_STAGGER_MS)
                loadAttachmentPreviewSuspend(chatId, msg.id, msg.attachmentName)
            }
        }
    }
    suspend fun loadAttachmentPreviewSuspend(
        chatId: String,
        messageId: String,
        fileName: String?,
    ) {
        bag.chatAttachmentPreviewMutex.withLock {
            if (!bag.mainState.value.isAuthenticated) return
            if (!canRequestAttachment(messageId)) return
            val cs = bag.mainState.value.chatState
            if (messageId in cs.attachmentPreviewUris || messageId in cs.attachmentLoadingIds) return
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        attachmentLoadingIds = it.chatState.attachmentLoadingIds + messageId,
                    ),
                )
            }
            try {
                val downloaded =
                    fetchAttachment(
                        chatId = chatId,
                        messageId = messageId,
                        fileName = fileName,
                        allowRecipientAcceptFallback = allowRecipientAcceptFallbackForMessage(messageId),
                    )
                bag.mainState.update {
                    val current = it.chatState
                    it.copy(
                        chatState = current.copy(
                            attachmentPreviewUris =
                                current.attachmentPreviewUris + (messageId to downloaded.absolutePath),
                            attachmentLoadingIds = current.attachmentLoadingIds - messageId,
                        ),
                    )
                }
            } catch (err: Throwable) {
                if (err is CancellationException) {
                    bag.mainState.update {
                        it.copy(
                            chatState = it.chatState.copy(
                                attachmentLoadingIds = it.chatState.attachmentLoadingIds - messageId,
                            ),
                        )
                    }
                    throw err
                }
                MobileTelemetry.reportError(err, "loadAttachmentPreview failed")
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            attachmentLoadingIds = it.chatState.attachmentLoadingIds - messageId,
                        ),
                    )
                }
            }
        }
    }
    fun canRequestAttachment(messageId: String): Boolean = bag.isServerBackedMessageId(messageId)

    fun allowRecipientAcceptFallbackForMessage(messageId: String): Boolean {
        val me = bag.mainState.value.chatState.meUserId ?: return true
        val msg = bag.mainState.value.chatState.selectedChatMessages.find { it.id == messageId } ?: return true
        val sender = msg.senderId ?: return true
        return sender != me
    }

    suspend fun fetchAttachment(
        chatId: String,
        messageId: String,
        fileName: String?,
        allowRecipientAcceptFallback: Boolean = true,
    ): DownloadedChatAttachment = withContext(Dispatchers.IO) {
        bag.downloadedAttachmentsCache[messageId]?.let { return@withContext it }
        val downloaded = bag.container.chatRepository.downloadAttachment(
            chatId = chatId,
            messageId = messageId,
            fileNameHint = fileName,
            allowRecipientAcceptFallback = allowRecipientAcceptFallback,
        )
        bag.downloadedAttachmentsCache[messageId] = downloaded
        if (bag.downloadedAttachmentsCache.size > 120) {
            val oldestKey = bag.downloadedAttachmentsCache.entries.firstOrNull()?.key
            if (oldestKey != null) {
                bag.downloadedAttachmentsCache.remove(oldestKey)
            }
        }
        downloaded
    }

    fun saveAttachmentToDownloads(downloaded: DownloadedChatAttachment) {
        val app = bag.host.application()
        val resolver = app.contentResolver
        val fileName = downloaded.fileName.ifBlank { "attachment-${System.currentTimeMillis()}" }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, downloaded.mimeType)
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_DOWNLOADS}/Empery",
                )
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val targetUri =
                resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
?: throw IllegalStateException(bag.host.appString(R.string.app_download_create_failed_media_store))
            try {
                val input =
                    openDownloadedAttachmentInput(downloaded, resolver)
                        ?: throw IllegalStateException(bag.host.appString(R.string.app_download_read_attachment_failed))
                input.use { stream ->
                    val output =
                        resolver.openOutputStream(targetUri)
                            ?: resolver.openOutputStream(targetUri, "w")
?: throw IllegalStateException(bag.host.appString(R.string.app_download_write_failed))
                    output.use { out -> stream.copyTo(out) }
                }
            } catch (err: Throwable) {
                runCatching { resolver.delete(targetUri, null, null) }
                val hint =
                    if (err is SecurityException) {
                        bag.host.appString(R.string.app_download_storage_permission)
                    } else {
                        err.message
                    }
                throw IllegalStateException(
                    hint ?: bag.host.appString(R.string.app_download_save_failed),
                    err,
                )
            }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(targetUri, values, null, null)
            return
        }

        val targetDir = app.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: throw IllegalStateException(bag.host.appString(R.string.app_download_folder_unavailable))
        val targetFile = java.io.File(targetDir, fileName)
        val input =
            openDownloadedAttachmentInput(downloaded, resolver)
                ?: throw IllegalStateException(bag.host.appString(R.string.app_download_read_attachment_failed))
        input.use { stream ->
            targetFile.outputStream().use { output ->
                stream.copyTo(output)
            }
        }
    }

    fun openDownloadedAttachmentInput(
        downloaded: DownloadedChatAttachment,
        resolver: ContentResolver,
    ): InputStream? {
        if (downloaded.absolutePath.isNotBlank()) {
            val f = java.io.File(downloaded.absolutePath)
            if (f.isFile) {
                return FileInputStream(f)
            }
        }
        return runCatching { resolver.openInputStream(downloaded.uri) }.getOrNull()
    }

    fun cancelImagePreviewPreload() {
        bag.chatImagePreviewPreloadJob?.cancel()
        bag.chatImagePreviewPreloadJob = null
    }
}
