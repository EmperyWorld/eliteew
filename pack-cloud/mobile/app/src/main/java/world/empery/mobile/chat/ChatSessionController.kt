/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin chat/GAF session facade: composes inbox, send/pending, attachment IO, and realtime reduce (W1 atomization).
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Public API remains delegated from MainViewModel for Activity/shell call-site stability.
 *
 * Related:
 * - ChatSessionBag, ChatInboxSession, ChatSendPendingController, ChatAttachmentIo, ChatRealtimeReduce
 */
package world.empery.mobile.chat

import feature.chat.ChatAttachmentDraft
import feature.chat.ChatListFilterTab
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import org.json.JSONObject
import world.empery.mobile.di.AppContainer

class ChatSessionController(
    scope: CoroutineScope,
    container: AppContainer,
    host: ChatSessionHost,
) {
    private val bag = ChatSessionBag(scope, container, host)

    /** Bridges inbox → realtime schedule without a temporal init cycle. */
    private val scheduleChatRefreshBridge = arrayOf<(Long) -> Unit>({ _ -> })

    private val inbox =
        ChatInboxSession(
            bag = bag,
            scheduleChatRefresh = { delayMs -> scheduleChatRefreshBridge[0](delayMs) },
        )
    private val attachments = ChatAttachmentIo(bag)
    private val realtime =
        ChatRealtimeReduce(
            bag = bag,
            refreshChatsInternal = { force -> inbox.refreshChatsInternal(force) },
        )
    private val send =
        ChatSendPendingController(
            bag = bag,
            setChatDraft = { chatId, draft -> inbox.setChatDraft(chatId, draft) },
            scheduleChatRefresh = { delayMs -> realtime.scheduleChatRefresh(delayMs) },
        )

    init {
        scheduleChatRefreshBridge[0] = { delayMs -> realtime.scheduleChatRefresh(delayMs) }
    }

    fun pendingMutationCount(): Int = bag.pendingSendPayloads.size

    fun chatQuickRefreshMs(): Long = CHAT_QUICK_REFRESH_MS

    fun cancelImagePreviewPreload() = attachments.cancelImagePreviewPreload()

    fun trimCachesForBackground() {
        bag.trimChatMessagesCacheForBackground()
        bag.trimDownloadedAttachmentsCacheForBackground()
    }

    fun clearForLogout() {
        bag.cancelJobsForLogout()
        bag.container.chatRepository.clearAttachmentDiskCache()
    }

    fun clearOnCleared() = clearForLogout()

    fun refreshChats(): Job = inbox.refreshChats()

    fun openChat(chatId: String) = inbox.openChat(chatId)

    fun setChatFilter(query: String) = inbox.setChatFilter(query)

    fun closeChat() = inbox.closeChat()

    fun proposeChatE2ee() = inbox.proposeChatE2ee()

    fun acceptChatE2ee() = inbox.acceptChatE2ee()

    fun declineChatE2ee() = inbox.declineChatE2ee()

    fun disableChatE2ee() = inbox.disableChatE2ee()

    fun setChatListFilterTab(tab: ChatListFilterTab) = inbox.setChatListFilterTab(tab)

    fun setChatDraft(chatId: String, draft: String) = inbox.setChatDraft(chatId, draft)

    fun setChatUserSearchQuery(query: String) = inbox.setChatUserSearchQuery(query)

    fun searchChatUsers(): Job = inbox.searchChatUsers()

    fun openOrCreateChatByUsername(username: String) = inbox.openOrCreateChatByUsername(username)

    fun loadOlderMessages(): Job = inbox.loadOlderMessages()

    fun toggleChatPinned(chatId: String) = inbox.toggleChatPinned(chatId)

    fun toggleChatMuted(chatId: String) = inbox.toggleChatMuted(chatId)

    fun toggleChatArchived(chatId: String) = inbox.toggleChatArchived(chatId)

    fun startReplyToMessage(messageId: String) = inbox.startReplyToMessage(messageId)

    fun cancelReplyToMessage() = inbox.cancelReplyToMessage()

    fun startEditMessage(messageId: String) = inbox.startEditMessage(messageId)

    fun cancelEditMessage() = inbox.cancelEditMessage()

    fun deleteChatMessage(messageId: String, forMeOnly: Boolean = false): Job =
        inbox.deleteChatMessage(messageId, forMeOnly)

    fun clearCurrentChatHistory(): Job = inbox.clearCurrentChatHistory()

    fun archiveCurrentChat(): Job = inbox.archiveCurrentChat()

    fun deleteCurrentChat(): Job = inbox.deleteCurrentChat()

    fun sendMessage(
        chatId: String,
        message: String,
        attachments: List<ChatAttachmentDraft>,
    ): Job = send.sendMessage(chatId, message, attachments)

    fun retryFailedMessage(messageId: String): Job = send.retryFailedMessage(messageId)

    fun cancelPendingMessage(messageId: String): Job = send.cancelPendingMessage(messageId)

    fun openAttachment(chatId: String, messageId: String, fileName: String?): Job =
        this.attachments.openAttachment(chatId, messageId, fileName)

    fun downloadAttachmentToDevice(chatId: String, messageId: String, fileName: String?): Job =
        this.attachments.downloadAttachmentToDevice(chatId, messageId, fileName)

    fun loadAttachmentPreview(chatId: String, messageId: String, fileName: String?): Job =
        this.attachments.loadAttachmentPreview(chatId, messageId, fileName)

    fun scheduleChatImagePreviewPreloads() = this.attachments.scheduleChatImagePreviewPreloads()

    fun scheduleChatRefresh(delayMs: Long = CHAT_LIST_REFRESH_DEBOUNCE_MS) =
        realtime.scheduleChatRefresh(delayMs)

    fun refreshOpenChatMessagesTail(delayMs: Long = CHAT_OPEN_TAIL_REFRESH_MS) =
        realtime.refreshOpenChatMessagesTail(delayMs)

    fun handleRealtimeMessageNew(payload: JSONObject) = realtime.handleRealtimeMessageNew(payload)

    fun handleRealtimeMessageRead(payload: JSONObject) = realtime.handleRealtimeMessageRead(payload)

    fun handleRealtimeMessageEdited(payload: JSONObject) =
        realtime.handleRealtimeMessageEdited(payload)

    fun handleRealtimeMessageDeleted(payload: JSONObject) =
        realtime.handleRealtimeMessageDeleted(payload)

    fun handleRealtimeChatCreated() = realtime.handleRealtimeChatCreated()

    fun handleRealtimeE2eeConsentChanged(payload: JSONObject) =
        realtime.handleRealtimeE2eeConsentChanged(payload)

    fun handleRealtimeNotification(payload: JSONObject) =
        realtime.handleRealtimeNotification(payload)
}
