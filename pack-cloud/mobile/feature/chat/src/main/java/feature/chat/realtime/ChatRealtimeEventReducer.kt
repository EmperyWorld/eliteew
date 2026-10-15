/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure state transitions for GAF chat Socket.IO events (MA-02.1).
 *
 * Invariants:
 * - No I/O, Android Context, or repository calls — effects list side work for the facade.
 *
 * Related:
 * - MainViewModel, RealtimeSocketCoordinator, ChatModels.kt mergeGafChatMessageNew
 */
package feature.chat.realtime

import feature.chat.ChatMessageUi
import feature.chat.ChatUiState
import feature.chat.GafChatMergeResult
import feature.chat.GafE2eeConsentUi
import feature.chat.GafChatMessageNewPayload
import feature.chat.mergeGafChatMessageNew
import feature.chat.sortedOldestFirstForChat
import org.json.JSONObject

/** Side effects the MainViewModel facade executes after applying [ChatRealtimeReduceResult]. */
sealed class ChatRealtimeEffect {
    data class ScheduleChatListRefresh(val delayMs: Long) : ChatRealtimeEffect()

    data class RefreshOpenChatTail(val delayMs: Long) : ChatRealtimeEffect()

    data class ShowNewMessageNotification(
        val chatId: String,
        val body: String,
    ) : ChatRealtimeEffect()

    data class PersistMessageCache(
        val chatId: String,
        val messages: List<ChatMessageUi>,
    ) : ChatRealtimeEffect()

    data class RemovePendingSend(val pendingId: String) : ChatRealtimeEffect()

    data class RememberE2eeStatusFromSocket(
        val chatId: String,
        val status: String,
    ) : ChatRealtimeEffect()

    data object RefreshNotifications : ChatRealtimeEffect()
}

data class ChatMessagesCacheUpdate(
    val chatId: String,
    val messages: List<ChatMessageUi>,
)

/**
 * Result of a pure reduce step.
 *
 * @param chatState Updated chat slice (equals input when unchanged).
 * @param cacheUpdate Non-null when [chatMessagesCache] entry should be replaced.
 * @param effects Ordered side effects for the host ViewModel.
 * @param skipped When true, host should not persist or mutate further.
 */
data class ChatRealtimeReduceResult(
    val chatState: ChatUiState,
    val cacheUpdate: ChatMessagesCacheUpdate? = null,
    val effects: List<ChatRealtimeEffect> = emptyList(),
    val skipped: Boolean = false,
)

object ChatRealtimeEventReducer {
    fun isMessageNewPayloadActionable(payload: JSONObject): Boolean {
        val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        if (chatId.isBlank()) return false
        val body = payload.optString("body")
        val attachmentContentId =
            payload.optString("attachment_content_id")
                .ifBlank { payload.optString("attachmentContentId") }
        val algorithm = payload.optString("algorithm")
        val bodyCiphertext = payload.optString("body_ciphertext")
        val hasE2eePayload = algorithm.startsWith("e2e_") && bodyCiphertext.isNotBlank()
        return body.isNotBlank() || attachmentContentId.isNotBlank() || hasE2eePayload
    }

    fun shouldShowNewMessageNotification(
        isMine: Boolean,
        appInForeground: Boolean,
        selectedChatId: String?,
        eventChatId: String,
        suppressNotification: Boolean,
    ): Boolean =
        !isMine &&
            (!appInForeground || selectedChatId != eventChatId) &&
            !suppressNotification

    fun reduceMessageNew(
        chatState: ChatUiState,
        chatId: String,
        incoming: ChatMessageUi,
        effectiveMe: String?,
        isMine: Boolean,
        appInForeground: Boolean,
        suppressNotification: Boolean,
        mergeResult: GafChatMergeResult,
        listRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        if (mergeResult.skippedDuplicate) {
            return ChatRealtimeReduceResult(chatState = chatState, skipped = true)
        }

        val effects = mutableListOf<ChatRealtimeEffect>()
        if (
            shouldShowNewMessageNotification(
                isMine = isMine,
                appInForeground = appInForeground,
                selectedChatId = chatState.selectedChatId,
                eventChatId = chatId,
                suppressNotification = suppressNotification,
            )
        ) {
            effects +=
                ChatRealtimeEffect.ShowNewMessageNotification(
                    chatId = chatId,
                    body = incoming.body,
                )
        }

        if (chatState.selectedChatId != chatId) {
            effects += ChatRealtimeEffect.ScheduleChatListRefresh(listRefreshDelayMs)
            return ChatRealtimeReduceResult(chatState = chatState, effects = effects)
        }

        val merged = mergeResult.messages
        mergeResult.removedPendingId?.let { effects += ChatRealtimeEffect.RemovePendingSend(it) }
        effects += ChatRealtimeEffect.PersistMessageCache(chatId, merged)

        val updatedChat =
            chatState.copy(
                meUserId = effectiveMe ?: chatState.meUserId,
                selectedChatMessages = merged,
            )
        return ChatRealtimeReduceResult(
            chatState = updatedChat,
            cacheUpdate = ChatMessagesCacheUpdate(chatId, merged),
            effects = effects,
        )
    }

    fun reduceMessageNewFromParsed(
        chatState: ChatUiState,
        chatId: String,
        parsed: GafChatMessageNewPayload,
        incoming: ChatMessageUi,
        effectiveMe: String?,
        isMine: Boolean,
        appInForeground: Boolean,
        suppressNotification: Boolean,
        listRefreshDelayMs: Long,
        quickRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        if (chatState.selectedChatMessages.any { it.id == parsed.messageId }) {
            return ChatRealtimeReduceResult(chatState = chatState, skipped = true)
        }
        val mergeResult = mergeGafChatMessageNew(chatState.selectedChatMessages, incoming, isMine)
        val base =
            reduceMessageNew(
                chatState = chatState,
                chatId = chatId,
                incoming = incoming,
                effectiveMe = effectiveMe,
                isMine = isMine,
                appInForeground = appInForeground,
                suppressNotification = suppressNotification,
                mergeResult = mergeResult,
                listRefreshDelayMs = listRefreshDelayMs,
            )
        if (base.skipped || chatState.selectedChatId != chatId) {
            return base
        }
        val extraEffects =
            if (parsed.usedSyntheticMessageId) {
                listOf(ChatRealtimeEffect.RefreshOpenChatTail(quickRefreshDelayMs))
            } else {
                emptyList()
            }
        return base.copy(effects = base.effects + extraEffects)
    }

    fun reduceMessageRead(
        chatState: ChatUiState,
        chatId: String,
        upToMessageId: String,
        listRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        val updated =
            if (chatState.selectedChatId == chatId) {
                chatState.copy(selectedChatPartnerLastReadMessageId = upToMessageId)
            } else {
                chatState
            }
        return ChatRealtimeReduceResult(
            chatState = updated,
            effects = listOf(ChatRealtimeEffect.ScheduleChatListRefresh(listRefreshDelayMs)),
        )
    }

    fun reduceMessageEdited(
        chatState: ChatUiState,
        chatId: String,
        messageId: String,
        editedBody: String,
        editedAt: String,
        backgroundCachedMessages: List<ChatMessageUi>?,
        followupRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        val patch: (ChatMessageUi) -> ChatMessageUi = { msg ->
            if (msg.id == messageId) {
                msg.copy(
                    body = editedBody.ifBlank { msg.body },
                    editedAt = editedAt.ifBlank { msg.editedAt },
                )
            } else {
                msg
            }
        }
        return reduceMessagePatched(
            chatState = chatState,
            chatId = chatId,
            patch = patch,
            backgroundCachedMessages = backgroundCachedMessages,
            followupRefreshDelayMs = followupRefreshDelayMs,
        )
    }

    fun reduceMessageDeleted(
        chatState: ChatUiState,
        chatId: String,
        messageId: String,
        backgroundCachedMessages: List<ChatMessageUi>?,
        followupRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        val patch: (ChatMessageUi) -> ChatMessageUi = { msg ->
            if (msg.id == messageId) {
                msg.copy(
                    isDeleted = true,
                    body = "",
                    attachmentContentId = null,
                    attachmentName = null,
                    attachmentMimeType = null,
                    attachmentSize = null,
                    localAttachmentPreviewUri = null,
                )
            } else {
                msg
            }
        }
        return reduceMessagePatched(
            chatState = chatState,
            chatId = chatId,
            patch = patch,
            backgroundCachedMessages = backgroundCachedMessages,
            followupRefreshDelayMs = followupRefreshDelayMs,
        )
    }

    private fun reduceMessagePatched(
        chatState: ChatUiState,
        chatId: String,
        patch: (ChatMessageUi) -> ChatMessageUi,
        backgroundCachedMessages: List<ChatMessageUi>?,
        followupRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        val effects =
            listOf(ChatRealtimeEffect.ScheduleChatListRefresh(followupRefreshDelayMs))
        if (chatState.selectedChatId != chatId) {
            val cached = backgroundCachedMessages ?: return ChatRealtimeReduceResult(chatState, effects = effects)
            val merged = cached.map(patch).sortedOldestFirstForChat()
            return ChatRealtimeReduceResult(
                chatState = chatState,
                cacheUpdate = ChatMessagesCacheUpdate(chatId, merged),
                effects = effects + ChatRealtimeEffect.PersistMessageCache(chatId, merged),
            )
        }
        val merged = chatState.selectedChatMessages.map(patch).sortedOldestFirstForChat()
        return ChatRealtimeReduceResult(
            chatState = chatState.copy(selectedChatMessages = merged),
            cacheUpdate = ChatMessagesCacheUpdate(chatId, merged),
            effects = effects + ChatRealtimeEffect.PersistMessageCache(chatId, merged),
        )
    }

    fun reduceChatCreated(
        chatState: ChatUiState,
        quickRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult =
        ChatRealtimeReduceResult(
            chatState = chatState,
            effects = listOf(ChatRealtimeEffect.ScheduleChatListRefresh(quickRefreshDelayMs)),
        )

    fun reduceE2eeConsentChanged(
        chatState: ChatUiState,
        chatId: String,
        status: String,
        ready: Boolean,
        requestedByUserId: String?,
        quickRefreshDelayMs: Long,
    ): ChatRealtimeReduceResult {
        val normalizedStatus = if (status == "active" && ready) "active" else status
        val effects =
            mutableListOf<ChatRealtimeEffect>(
                ChatRealtimeEffect.RememberE2eeStatusFromSocket(chatId, normalizedStatus),
                ChatRealtimeEffect.ScheduleChatListRefresh(quickRefreshDelayMs),
            )
        val updated =
            if (chatState.selectedChatId == chatId) {
                chatState.copy(
                    e2eeConsent =
                        GafE2eeConsentUi(
                            chatId = chatId,
                            status = status,
                            ready = ready,
                            requestedByUserId = requestedByUserId,
                        ),
                )
            } else {
                chatState
            }
        return ChatRealtimeReduceResult(chatState = updated, effects = effects)
    }

    fun reduceGenericNotification(
        chatState: ChatUiState,
        title: String,
        message: String,
    ): ChatRealtimeReduceResult {
        if (title.isBlank() && message.isBlank()) {
            return ChatRealtimeReduceResult(chatState = chatState)
        }
        return ChatRealtimeReduceResult(
            chatState = chatState,
            effects = listOf(ChatRealtimeEffect.RefreshNotifications),
        )
    }
}
