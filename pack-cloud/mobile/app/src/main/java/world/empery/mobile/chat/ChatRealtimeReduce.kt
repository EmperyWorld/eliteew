/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat realtime reduce application: socket message handlers and open-tail refresh.
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Composed by ChatSessionController; public API remains on ChatSessionController / MainViewModel.
 *
 * Related:
 * - ChatSessionController, ChatSessionBag, MainViewModel
 */
package world.empery.mobile.chat

import feature.chat.parseGafChatMessageNewPayload
import feature.chat.realtime.ChatRealtimeEffect
import feature.chat.realtime.ChatRealtimeEventReducer
import feature.chat.realtime.ChatRealtimeReduceResult
import feature.notifications.NotificationPreferenceCategory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.push.IncomingCallAlertSupport

internal class ChatRealtimeReduce(
    private val bag: ChatSessionBag,
    private val refreshChatsInternal: (Boolean) -> kotlinx.coroutines.Job,
) {
    fun applyChatRealtimeReduceResult(
        result: ChatRealtimeReduceResult,
        guardChatId: String? = null,
    ) {
        if (result.skipped) return
        result.cacheUpdate?.let { bag.chatMessagesCache[it.chatId] = it.messages }
        bag.mainState.update { current ->
            if (guardChatId != null && current.chatState.selectedChatId != guardChatId) {
                return@update current
            }
            if (current.chatState == result.chatState) return@update current
            current.copy(chatState = result.chatState)
        }
    }

    suspend fun applyChatRealtimeEffects(effects: List<ChatRealtimeEffect>) {
        for (effect in effects) {
            when (effect) {
                is ChatRealtimeEffect.ScheduleChatListRefresh ->
                    scheduleChatRefresh(effect.delayMs)
                is ChatRealtimeEffect.RefreshOpenChatTail ->
                    refreshOpenChatMessagesTail(effect.delayMs)
                is ChatRealtimeEffect.ShowNewMessageNotification ->
                    world.empery.mobile.push.NotificationHelper.showNotification(
                        context = bag.host.application(),
                        title = bag.host.appString(R.string.app_chat_new_message_title),
                        body = effect.body.ifBlank { "📎 Вложение" },
                        tab = "chat",
                        targetChatId = effect.chatId,
                        category = NotificationPreferenceCategory.CHAT,
                    )
                is ChatRealtimeEffect.PersistMessageCache ->
                    withContext(Dispatchers.IO) {
                        bag.container.chatRepository.replaceMessageCache(effect.chatId, effect.messages)
                    }
                is ChatRealtimeEffect.RemovePendingSend ->
                    bag.pendingSendPayloads.remove(effect.pendingId)
                is ChatRealtimeEffect.RememberE2eeStatusFromSocket ->
                    bag.container.chatRepository.rememberChatE2eeStatusFromSocket(
                        effect.chatId,
                        effect.status,
                    )
                is ChatRealtimeEffect.RefreshNotifications ->
                    bag.host.refreshNotifications()
            }
        }
    }

    fun handleRealtimeMessageNew(payload: JSONObject) {
        if (!ChatRealtimeEventReducer.isMessageNewPayloadActionable(payload)) return
        bag.scope.launch messageNewLaunch@{
            if (!bag.mainState.value.isAuthenticated) return@messageNewLaunch
            val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
            val resolvedMe =
                withContext(Dispatchers.IO) {
                    bag.mainState.value.chatState.meUserId ?: bag.container.chatRepository.getCurrentUserId()
                }
            if (!bag.mainState.value.isAuthenticated) return@messageNewLaunch
            val preChat = bag.mainState.value.chatState
            val effectiveMe = preChat.meUserId ?: resolvedMe
            val parsed = parseGafChatMessageNewPayload(payload) ?: return@messageNewLaunch
            val isMine =
                parsed.senderId.isNullOrBlank().not() &&
                    effectiveMe != null &&
                    parsed.senderId == effectiveMe
            val incoming =
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.socketMessageToUi(chatId, parsed)
                }
            val result =
                ChatRealtimeEventReducer.reduceMessageNewFromParsed(
                    chatState = preChat,
                    chatId = chatId,
                    parsed = parsed,
                    incoming = incoming,
                    effectiveMe = effectiveMe,
                    isMine = isMine,
                    appInForeground = bag.host.isAppInForeground(),
                    suppressNotification =
                        IncomingCallAlertSupport.shouldSuppressChatNotification(payload),
                    listRefreshDelayMs = CHAT_LIST_REFRESH_DEBOUNCE_MS,
                    quickRefreshDelayMs = CHAT_QUICK_REFRESH_MS,
                )
            if (result.skipped) return@messageNewLaunch
            applyChatRealtimeReduceResult(result, guardChatId = chatId)
            applyChatRealtimeEffects(result.effects)
        }
    }

    fun handleRealtimeMessageRead(payload: JSONObject) {
        val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val upToMessageId =
            payload.optString("up_to_message_id").ifBlank { payload.optString("upToMessageId") }
        if (chatId.isBlank() || upToMessageId.isBlank()) return
        val result =
            ChatRealtimeEventReducer.reduceMessageRead(
                chatState = bag.mainState.value.chatState,
                chatId = chatId,
                upToMessageId = upToMessageId,
                listRefreshDelayMs = CHAT_LIST_REFRESH_DEBOUNCE_MS,
            )
        applyChatRealtimeReduceResult(result)
        scheduleChatRefresh(CHAT_LIST_REFRESH_DEBOUNCE_MS)
    }

    fun handleRealtimeMessageEdited(payload: JSONObject) {
        val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val messageId = payload.optString("message_id").ifBlank { payload.optString("messageId") }
        val editedBody = payload.optString("body")
        val editedAt = payload.optString("edited_at").ifBlank { payload.optString("editedAt") }
        if (chatId.isBlank() || messageId.isBlank()) return
        bag.scope.launch messageEditLaunch@{
            if (!bag.mainState.value.isAuthenticated) return@messageEditLaunch
            val preEdit = bag.mainState.value.chatState
            val result =
                ChatRealtimeEventReducer.reduceMessageEdited(
                    chatState = preEdit,
                    chatId = chatId,
                    messageId = messageId,
                    editedBody = editedBody,
                    editedAt = editedAt,
                    backgroundCachedMessages = bag.chatMessagesCache[chatId],
                    followupRefreshDelayMs = CHAT_OPEN_FOLLOWUP_REFRESH_MS,
                )
            applyChatRealtimeReduceResult(result, guardChatId = chatId)
            applyChatRealtimeEffects(result.effects)
        }
    }

    fun handleRealtimeMessageDeleted(payload: JSONObject) {
        val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val messageId = payload.optString("message_id").ifBlank { payload.optString("messageId") }
        if (chatId.isBlank() || messageId.isBlank()) return
        bag.scope.launch messageDeleteLaunch@{
            if (!bag.mainState.value.isAuthenticated) return@messageDeleteLaunch
            val preDel = bag.mainState.value.chatState
            val result =
                ChatRealtimeEventReducer.reduceMessageDeleted(
                    chatState = preDel,
                    chatId = chatId,
                    messageId = messageId,
                    backgroundCachedMessages = bag.chatMessagesCache[chatId],
                    followupRefreshDelayMs = CHAT_OPEN_FOLLOWUP_REFRESH_MS,
                )
            applyChatRealtimeReduceResult(result, guardChatId = chatId)
            applyChatRealtimeEffects(result.effects)
        }
    }

    fun handleRealtimeChatCreated() {
        scheduleChatRefresh(CHAT_QUICK_REFRESH_MS)
    }

    fun handleRealtimeE2eeConsentChanged(payload: JSONObject) {
        val chatId = payload.optString("chat_id").ifBlank { payload.optString("chatId") }
        val status = payload.optString("status").ifBlank { "off" }
        val ready = payload.optBoolean("ready", false)
        val requestedBy =
            payload.optString("requested_by_user_id").trim().ifBlank { null }
        if (chatId.isBlank()) return
        val result =
            ChatRealtimeEventReducer.reduceE2eeConsentChanged(
                chatState = bag.mainState.value.chatState,
                chatId = chatId,
                status = status,
                ready = ready,
                requestedByUserId = requestedBy,
                quickRefreshDelayMs = CHAT_QUICK_REFRESH_MS,
            )
        applyChatRealtimeReduceResult(result, guardChatId = chatId)
        bag.scope.launch {
            applyChatRealtimeEffects(result.effects)
        }
    }

    fun handleRealtimeNotification(payload: JSONObject) {
        val title = payload.optString("title")
        val message = payload.optString("message")
        if (title.isNotBlank() || message.isNotBlank()) {
            world.empery.mobile.push.NotificationHelper.showNotification(
                context = bag.host.application(),
                title = title,
                body = message,
                tab = "notifications",
            )
        }
        bag.host.refreshNotifications()
    }
    fun scheduleChatRefresh(delayMs: Long = CHAT_LIST_REFRESH_DEBOUNCE_MS) {
        if (!bag.mainState.value.isAuthenticated) return
        bag.chatRefreshDebounceJob?.cancel()
        bag.chatRefreshDebounceJob = bag.scope.launch {
            delay(delayMs)
            if (!bag.mainState.value.isAuthenticated) return@launch
            refreshChatsInternal(true)
        }
    }

    fun refreshOpenChatMessagesTail(delayMs: Long = CHAT_OPEN_TAIL_REFRESH_MS) {
        if (!bag.mainState.value.isAuthenticated) return
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        bag.openChatTailRefreshJob?.cancel()
        bag.openChatTailRefreshJob =
            bag.scope.launch {
                delay(delayMs)
                if (!bag.mainState.value.isAuthenticated) return@launch
                if (bag.mainState.value.chatState.selectedChatId != chatId) return@launch
                mergeOpenChatTailFromServer(chatId)
            }
    }

    suspend fun mergeOpenChatTailFromServer(chatId: String) {
        val pageResult =
            runCatching {
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.ensureGafE2eeWireIdentity()
                    bag.container.chatRepository.loadMessagesPage(
                        chatId,
                        bag.chatPageSize,
                        beforeMessageId = null,
                    )
                }
            }
        pageResult
            .onSuccess { page ->
                if (bag.mainState.value.chatState.selectedChatId != chatId) return@onSuccess
                val me = bag.mainState.value.chatState.meUserId
                val pending = bag.pendingMessagesForChat(chatId, me)
                val existing = bag.mainState.value.chatState.selectedChatMessages
                val pageIds = page.map { it.id }.toSet()
                val olderKept =
                    existing.filter { msg ->
                        msg.id !in pageIds &&
                            !msg.id.startsWith("socket-") &&
                            !msg.isPending &&
                            !msg.isFailed
                    }
                val merged =
                    bag.sortChatMessages(
                        bag.mergeChatMessagesDedupingById(olderKept + page + pending),
                    )
                val diskPreviews =
                    withContext(Dispatchers.IO) {
                        bag.container.chatRepository.attachmentPreviewUrisFromDiskCache(chatId, merged)
                    }
                bag.chatMessagesCache[chatId] = merged
                bag.mainState.update {
                    if (it.chatState.selectedChatId != chatId) return@update it
                    it.copy(
                        chatState =
                            it.chatState.copy(
                                selectedChatMessages = merged,
                                hasMoreMessages = page.size < bag.chatPageSize || olderKept.isNotEmpty(),
                                isMessagesLoading = false,
                                attachmentPreviewUris = diskPreviews + it.chatState.attachmentPreviewUris,
                            ),
                    )
                }
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.replaceMessageCache(chatId, merged)
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshOpenChatMessagesTail failed")
            }
    }

}
