/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat send/pending/outbox orchestration: send, edit, retry, and cancel pending messages.
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Composed by ChatSessionController; public API remains on ChatSessionController / MainViewModel.
 *
 * Related:
 * - ChatSessionController, ChatSessionBag, MainViewModel
 */
package world.empery.mobile.chat

import feature.chat.ChatAttachmentDraft
import feature.chat.ChatMessageUi
import feature.chat.UploadedChatAttachment
import feature.chat.resolveChatAttachmentMimeType
import kotlin.random.Random
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry

internal class ChatSendPendingController(
    private val bag: ChatSessionBag,
    private val setChatDraft: (String, String) -> Unit,
    private val scheduleChatRefresh: (Long) -> Unit,
) {
    fun sendMessage(
        chatId: String,
        message: String,
        attachments: List<ChatAttachmentDraft>,
    ): Job = bag.scope.launch {
        if (!bag.mainState.value.isAuthenticated) return@launch
        val trimmed = message.trim()
        val editingMessageId = bag.mainState.value.chatState.editingMessageId
        if (!editingMessageId.isNullOrBlank()) {
            if (attachments.isNotEmpty()) {
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = bag.host.appString(R.string.app_chat_edit_no_attachments),
                        ),
                    )
                }
                return@launch
            }
            if (trimmed.isBlank()) {
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = bag.host.appString(R.string.app_chat_empty_message),
                        ),
                    )
                }
                return@launch
            }
            runCatching {
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.editMessage(chatId, editingMessageId, trimmed)
                }
            }.onSuccess { edited ->
                val merged =
                    bag.sortChatMessages(
                        bag.mainState.value.chatState.selectedChatMessages.map { msg ->
                            if (msg.id == editingMessageId) edited else msg
                        },
                    )
                bag.chatMessagesCache[chatId] = merged
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.replaceMessageCache(chatId, merged)
                }
                setChatDraft(chatId, "")
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            selectedChatMessages = merged,
                            editingMessageId = null,
                            replyingToMessageId = null,
                            operationHint = bag.host.appString(R.string.app_chat_message_updated),
                            error = null,
                        ),
                    )
                }
                scheduleChatRefresh(CHAT_QUICK_REFRESH_MS)
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "editMessage failed")
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = err.message ?: bag.host.appString(R.string.app_chat_edit_failed),
                        ),
                    )
                }
            }
            return@launch
        }

        var replyToMessageId = bag.mainState.value.chatState.replyingToMessageId
        if (attachments.isEmpty()) {
            sendSingleMessage(chatId, trimmed, null, replyToMessageId, null)
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        replyingToMessageId = null,
                        editingMessageId = null,
                    ),
                )
            }
            return@launch
        }

        var bodyRemainder = trimmed
        var attachmentUploadFailed = false
        for (attachment in attachments) {
            if (attachmentUploadFailed) break
            val uploadedResult =
                runCatching {
                    withContext(Dispatchers.IO) {
                        bag.container.chatRepository.uploadAttachment(attachment)
                    }
                }
            uploadedResult.onSuccess { uploaded ->
                val mime = resolveChatAttachmentMimeType(
                    attachment.mimeType.takeIf { it.isNotBlank() },
                    attachment.displayName.takeIf { it.isNotBlank() },
                )
                val localPreview =
                    if (mime?.startsWith("image/") == true) attachment.uri else null
                sendSingleMessage(
                    chatId = chatId,
                    body = bodyRemainder,
                    uploadedAttachment = uploaded,
                    replyToMessageId = replyToMessageId,
                    localImagePreviewUri = localPreview,
                )
                bodyRemainder = ""
                replyToMessageId = null
            }.onFailure { err ->
                if (err is CancellationException) throw err
                attachmentUploadFailed = true
                MobileTelemetry.reportError(err, "uploadAttachment failed")
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            error = err.message ?: bag.host.appString(R.string.app_chat_upload_attachment_failed),
                        ),
                    )
                }
            }
        }
        if (!attachmentUploadFailed && bodyRemainder.isNotBlank()) {
            sendSingleMessage(chatId, bodyRemainder, null, replyToMessageId, null)
        }
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(
                    replyingToMessageId = null,
                    editingMessageId = null,
                ),
            )
        }
    }

    fun retryFailedMessage(messageId: String): Job = bag.scope.launch {
        val payload = bag.pendingSendPayloads[messageId] ?: return@launch
        if (bag.mainState.value.chatState.selectedChatId != payload.chatId) return@launch
        val withoutFailed =
            bag.sortChatMessages(
                bag.mainState.value.chatState.selectedChatMessages.filter { it.id != messageId },
            )
        bag.mainState.update { it.copy(chatState = it.chatState.copy(selectedChatMessages = withoutFailed)) }
        bag.pendingSendPayloads.remove(messageId)
        withContext(Dispatchers.IO) {
            bag.container.chatRepository.deletePendingSend(messageId)
        }
        sendSingleMessage(
            chatId = payload.chatId,
            body = payload.body,
            uploadedAttachment = payload.uploadedAttachment,
            replyToMessageId = payload.replyToMessageId,
            localImagePreviewUri = payload.localImagePreviewUri,
        )
    }

    fun cancelPendingMessage(messageId: String): Job = bag.scope.launch {
        val payload = bag.pendingSendPayloads[messageId] ?: return@launch
        if (bag.mainState.value.chatState.selectedChatId != payload.chatId) return@launch
        bag.pendingSendPayloads.remove(messageId)
        withContext(Dispatchers.IO) {
            bag.container.chatRepository.deletePendingSend(messageId)
        }
        val without =
            bag.sortChatMessages(
                bag.mainState.value.chatState.selectedChatMessages.filter { it.id != messageId },
            )
        bag.mainState.update { it.copy(chatState = it.chatState.copy(selectedChatMessages = without)) }
    }
    suspend fun sendSingleMessage(
        chatId: String,
        body: String,
        uploadedAttachment: UploadedChatAttachment?,
        replyToMessageId: String?,
        localImagePreviewUri: String?,
    ) {
        if (!bag.mainState.value.isAuthenticated) return
        var meId = bag.mainState.value.chatState.meUserId
        if (meId == null) {
            meId = withContext(Dispatchers.IO) { bag.container.chatRepository.getCurrentUserId() }
            if (meId != null && bag.mainState.value.chatState.meUserId == null) {
                bag.mainState.update { it.copy(chatState = it.chatState.copy(meUserId = meId)) }
            }
        }
        val createdAtEpochMs = System.currentTimeMillis()
        val pendingId = "pending-$createdAtEpochMs-${Random.nextInt(0, 999)}"
        MobileTelemetry.trackBusinessEvent(
            "chat_send_started",
            mapOf("has_attachment" to (uploadedAttachment != null).toString()),
        )
        val effectiveMe = meId ?: bag.mainState.value.chatState.meUserId
        val pending =
            ChatMessageUi(
                id = pendingId,
                senderId = effectiveMe,
                body = body,
                createdAt = null,
                attachmentContentId = uploadedAttachment?.contentId,
                attachmentName = uploadedAttachment?.fileName,
                attachmentMimeType = uploadedAttachment?.mimeType,
                attachmentSize = uploadedAttachment?.sizeBytes,
                localAttachmentPreviewUri = localImagePreviewUri,
                replyToMessageId = replyToMessageId,
                isPending = true,
            )
        val payload =
            PendingSendPayload(
                chatId = chatId,
                body = body,
                uploadedAttachment = uploadedAttachment,
                replyToMessageId = replyToMessageId,
                localImagePreviewUri = localImagePreviewUri,
                createdAtEpochMs = createdAtEpochMs,
            )
        bag.pendingSendPayloads[pendingId] = payload
        withContext(Dispatchers.IO) {
            bag.container.chatRepository.savePendingSend(with(bag) { payload.toEntity(pendingId) })
        }
        val withPending = bag.sortChatMessages(bag.mainState.value.chatState.selectedChatMessages + pending)
        bag.mainState.update { it.copy(chatState = it.chatState.copy(selectedChatMessages = withPending)) }
        val partnerUserId = bag.mainState.value.chatState.chats.find { it.chatId == chatId }?.partnerId
        runCatching {
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.sendMessage(
                    chatId = chatId,
                    message = body,
                    attachmentContentId = uploadedAttachment?.contentId,
                    replyToMessageId = replyToMessageId,
                    partnerUserId = partnerUserId,
                )
            }
        }.onSuccess { sent ->
            bag.pendingSendPayloads.remove(pendingId)
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.deletePendingSend(pendingId)
            }
            MobileTelemetry.trackBusinessEvent("chat_send_succeeded")
            if (bag.mainState.value.chatState.selectedChatId == chatId) {
                val replaced =
                    bag.sortChatMessages(
                        bag.mainState.value.chatState.selectedChatMessages.map { msg ->
                            if (msg.id == pendingId) sent else msg
                        },
                    )
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            selectedChatMessages = replaced,
                            operationHint = null,
                            error = null,
                        ),
                    )
                }
                bag.chatMessagesCache[chatId] = bag.mainState.value.chatState.selectedChatMessages
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.replaceMessageCache(
                        chatId,
                        bag.mainState.value.chatState.selectedChatMessages,
                    )
                }
            }
            scheduleChatRefresh(CHAT_LIST_REFRESH_DEBOUNCE_MS)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "sendMessage failed")
            MobileTelemetry.trackBusinessEvent("chat_send_failed")
            val failedReason = err.message ?: bag.host.appString(R.string.app_chat_send_failed)
            val failedPayload = payload.copy(failedReason = failedReason)
            bag.pendingSendPayloads[pendingId] = failedPayload
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.savePendingSend(with(bag) { failedPayload.toEntity(pendingId) })
            }
            if (bag.mainState.value.chatState.selectedChatId == chatId) {
                val failed =
                    bag.sortChatMessages(
                        bag.mainState.value.chatState.selectedChatMessages.map { msg ->
                            if (msg.id == pendingId) {
                                msg.copy(isPending = false, isFailed = true, failedReason = failedReason)
                            } else {
                                msg
                            }
                        },
                    )
                bag.mainState.update { it.copy(chatState = it.chatState.copy(selectedChatMessages = failed)) }
                bag.chatMessagesCache[chatId] = failed
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.replaceMessageCache(chatId, failed)
                }
            }
        }
    }
}
