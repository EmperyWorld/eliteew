/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public GAF Chat screen shell: state wiring, attachment pickers, adaptive panes, and dialogs.
 * Focused list, thread, timeline, row, attachment, and composer UI lives in sibling production files.
 *
 * Invariants:
 * - ChatLiteScreen signature remains stable for MainActivity and MainViewModel callbacks.
 * - Compact and master-detail layouts share one ChatListPane and one ChatThreadPane implementation.
 * - GAF composer draft remains local while persistence is delegated to MainViewModel.
 *
 * Related:
 * - ChatListPane.kt, ChatThreadPane.kt, ChatScreenContracts.kt
 */
package feature.chat

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.PremiumStateCard

@Composable
fun ChatLiteScreen(
    state: ChatUiState,
    onOpenChat: (String) -> Unit,
    onCloseChat: () -> Unit,
    onLoadOlderMessages: () -> Unit,
    onChatFilterChange: (String) -> Unit,
    onFilterTabChange: (ChatListFilterTab) -> Unit,
    onTogglePinned: (String) -> Unit,
    onToggleMuted: (String) -> Unit,
    onToggleArchived: (String) -> Unit,
    onSetUserSearchQuery: (String) -> Unit,
    onSearchUsers: () -> Unit,
    onOpenOrCreateChatByUsername: (String) -> Unit,
    onSetDraft: (chatId: String, draft: String) -> Unit,
    onSendMessage: (chatId: String, message: String, attachments: List<ChatAttachmentDraft>) -> Unit,
    onRetryMessage: (messageId: String) -> Unit,
    onCancelMessage: (messageId: String) -> Unit,
    onStartReply: (String) -> Unit,
    onCancelReply: () -> Unit,
    onStartEdit: (String) -> Unit,
    onCancelEdit: () -> Unit,
    onDeleteMessage: (String) -> Unit,
    onClearChat: () -> Unit,
    onArchiveChat: () -> Unit,
    onDeleteChat: () -> Unit,
    onOpenAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    onDownloadAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    onLoadAttachmentPreview: (chatId: String, messageId: String, fileName: String?) -> Unit,
    onScheduleImagePreviewPreloads: () -> Unit,
    onStartVideoCall: (String) -> Unit,
    onStartGroupVideoCall: (String) -> Unit,
    onProposeChatE2ee: () -> Unit = {},
    onAcceptChatE2ee: () -> Unit = {},
    onDeclineChatE2ee: () -> Unit = {},
    onDisableChatE2ee: () -> Unit = {},
    meDisplayName: String? = null,
    meAvatarUrl: String? = null,
) {
    val context = LocalContext.current
    val windowLayout = LocalMobileWindowLayout.current
    val attachments = remember { mutableStateListOf<ChatAttachmentDraft>() }
    var attachmentError by remember { mutableStateOf<String?>(null) }
    var destructiveDialog by remember { mutableStateOf(ChatDestructiveDialog.None) }
    var listPartnerMeta by remember { mutableStateOf(emptyMap<String, GafChatListPartnerMeta>()) }
    val selectedChatId = state.selectedChatId
    val persistedDraft =
        selectedChatId?.let { chatId -> state.composerDrafts[chatId] }.orEmpty()
    var localDraft by remember(selectedChatId) { mutableStateOf(persistedDraft) }

    LaunchedEffect(state.chats, state.isLoading) {
        listPartnerMeta = ChatLocalSettingsStore(context).loadPartnerMeta()
    }
    LaunchedEffect(selectedChatId) {
        localDraft = selectedChatId?.let { state.composerDrafts[it] }.orEmpty()
    }
    LaunchedEffect(state.editingMessageId, persistedDraft) {
        if (state.editingMessageId != null) {
            localDraft = persistedDraft
        }
    }
    LaunchedEffect(persistedDraft) {
        if (persistedDraft.isEmpty() && localDraft.isNotEmpty()) {
            localDraft = ""
        }
    }

    val imagePicker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            uri?.let {
                val result =
                    validateAndBuildAttachment(
                        context = context,
                        uri = it,
                        currentCount = attachments.size,
                    )
                result.attachment?.let(attachments::add)
                attachmentError = result.error
            }
        }
    val filePicker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let {
                val result =
                    validateAndBuildAttachment(
                        context = context,
                        uri = it,
                        currentCount = attachments.size,
                    )
                result.attachment?.let(attachments::add)
                attachmentError = result.error
            }
        }
    val filteredChats =
        remember(
            state.chats,
            state.chatFilter,
            state.activeFilterTab,
            state.chatLocalFlags,
        ) {
            filterChatsForPane(state)
        }
    val selectedChat = state.chats.find { it.chatId == selectedChatId }
    val showVideoCallAction = selectedChat != null && !selectedChat.isSystemAccount
    val listActions =
        ChatListActions(
            onOpenChat = onOpenChat,
            onChatFilterChange = onChatFilterChange,
            onFilterTabChange = onFilterTabChange,
            onTogglePinned = onTogglePinned,
            onToggleMuted = onToggleMuted,
            onToggleArchived = onToggleArchived,
            onSetUserSearchQuery = onSetUserSearchQuery,
            onSearchUsers = onSearchUsers,
            onOpenOrCreateChatByUsername = onOpenOrCreateChatByUsername,
        )
    val threadActions =
        ChatThreadActions(
            onPickImage = { imagePicker.launch("image/*") },
            onPickFile = { filePicker.launch(ALLOWED_FILE_PICKER_TYPES.toTypedArray()) },
            onRemoveAttachment = { id ->
                attachments.removeAll { it.id == id }
                if (attachments.isEmpty()) attachmentError = null
            },
            onDraftChange = { value ->
                localDraft = value
                selectedChatId?.let { chatId -> onSetDraft(chatId, value) }
            },
            onSend = send@{
                val chatId = selectedChatId ?: return@send
                val text = localDraft.trim()
                if (text.isEmpty() && attachments.isEmpty()) return@send
                onSendMessage(chatId, text, attachments.toList())
                localDraft = ""
                onSetDraft(chatId, "")
                attachments.clear()
                attachmentError = null
            },
            onLoadOlderMessages = onLoadOlderMessages,
            onRetryMessage = onRetryMessage,
            onCancelMessage = onCancelMessage,
            onStartReply = onStartReply,
            onCancelReply = onCancelReply,
            onStartEdit = onStartEdit,
            onCancelEdit = onCancelEdit,
            onDeleteMessage = onDeleteMessage,
            onOpenAttachment = onOpenAttachment,
            onDownloadAttachment = onDownloadAttachment,
            onLoadAttachmentPreview = onLoadAttachmentPreview,
            onScheduleImagePreviewPreloads = onScheduleImagePreviewPreloads,
            onProposeChatE2ee = onProposeChatE2ee,
            onAcceptChatE2ee = onAcceptChatE2ee,
            onDeclineChatE2ee = onDeclineChatE2ee,
            onDisableChatE2ee = onDisableChatE2ee,
        )

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        if (!windowLayout.useChatMasterDetail) {
            ChatTopBar(
                selectedChat = selectedChat,
                listPartnerMeta = listPartnerMeta,
                visibleChatsCount = filteredChats.size,
                unreadChatsCount = totalChatUnreadCount(state.chats),
                onCloseChat = onCloseChat,
                onRequestClearHistory = {
                    destructiveDialog = ChatDestructiveDialog.ClearHistory
                },
                onRequestArchiveChat = onArchiveChat,
                onRequestDeleteChat = {
                    destructiveDialog = ChatDestructiveDialog.DeleteChat
                },
                showVideoCallAction = showVideoCallAction,
                onStartVideoCall = {
                    selectedChatId?.let(onStartVideoCall)
                },
                onStartGroupVideoCall = {
                    selectedChatId?.let(onStartGroupVideoCall)
                },
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
        ChatScreenStateBanners(
            error = state.error,
            operationHint = state.operationHint,
            attachmentError = attachmentError,
        )
        if (windowLayout.useChatMasterDetail && selectedChatId != null) {
            val weights =
                resolveGafChatMasterDetailPaneWeights(
                    widthClass = windowLayout.widthClass,
                    listPaneWidthDp = windowLayout.chatListPaneWidthDp,
                    totalWidthDp = windowLayout.screenWidthDp,
                )
            Row(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ChatListPane(
                    state = state,
                    filteredChats = filteredChats,
                    listPartnerMeta = listPartnerMeta,
                    showTopBar = true,
                    masterDetailListPane = true,
                    actions = listActions,
                    modifier =
                        Modifier
                            .weight(weights.listWeight)
                            .widthIn(
                                min =
                                    resolveGafChatListPaneMinWidthDp(
                                        windowLayout.chatListPaneWidthDp,
                                    ),
                            ),
                )
                Column(
                    modifier =
                        Modifier
                            .weight(weights.threadWeight)
                            .fillMaxSize(),
                ) {
                    ChatTopBar(
                        selectedChat = selectedChat,
                        listPartnerMeta = listPartnerMeta,
                        visibleChatsCount = filteredChats.size,
                        unreadChatsCount = totalChatUnreadCount(state.chats),
                        onCloseChat = onCloseChat,
                        onRequestClearHistory = {
                            destructiveDialog = ChatDestructiveDialog.ClearHistory
                        },
                        onRequestArchiveChat = onArchiveChat,
                        onRequestDeleteChat = {
                            destructiveDialog = ChatDestructiveDialog.DeleteChat
                        },
                        showVideoCallAction = showVideoCallAction,
                        onStartVideoCall = {
                            selectedChatId.let(onStartVideoCall)
                        },
                        onStartGroupVideoCall = {
                            selectedChatId.let(onStartGroupVideoCall)
                        },
                        showBackNavigation = false,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    ChatThreadPane(
                        state = state,
                        draft = localDraft,
                        attachments = attachments,
                        actions = threadActions,
                        meDisplayName = meDisplayName,
                        meAvatarUrl = meAvatarUrl,
                        modifier = Modifier.weight(1f).imePadding(),
                    )
                }
            }
        } else if (selectedChatId == null) {
            ChatListPane(
                state = state,
                filteredChats = filteredChats,
                listPartnerMeta = listPartnerMeta,
                showTopBar = windowLayout.useChatMasterDetail,
                masterDetailListPane = false,
                actions = listActions,
                modifier = Modifier.weight(1f),
            )
        } else {
            ChatThreadPane(
                state = state,
                draft = localDraft,
                attachments = attachments,
                actions = threadActions,
                meDisplayName = meDisplayName,
                meAvatarUrl = meAvatarUrl,
                modifier = Modifier.weight(1f).imePadding(),
            )
        }
    }
    ChatDestructiveDialogHost(
        dialog = destructiveDialog,
        onDismiss = { destructiveDialog = ChatDestructiveDialog.None },
        onClear = {
            destructiveDialog = ChatDestructiveDialog.None
            onClearChat()
        },
        onDelete = {
            destructiveDialog = ChatDestructiveDialog.None
            onDeleteChat()
        },
    )
}

@Composable
private fun ChatScreenStateBanners(
    error: String?,
    operationHint: String?,
    attachmentError: String?,
) {
    val context = LocalContext.current
    error?.let {
        ChatErrorBanner(error = it)
        Spacer(modifier = Modifier.height(4.dp))
    }
    operationHint?.takeIf { it.isNotBlank() }?.let { hint ->
        Text(
            text = hint,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        Spacer(modifier = Modifier.height(4.dp))
    }
    attachmentError?.takeIf { it.isNotBlank() }?.let { attachError ->
        PremiumStateCard(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) {
                        contentDescription =
                            context.getString(
                                R.string.chat_attachment_error_cd,
                                attachError,
                            )
                    },
            title = stringResource(R.string.chat_title),
            message = attachError,
            icon = Icons.Outlined.AttachFile,
            isError = true,
        )
        Spacer(modifier = Modifier.height(4.dp))
    }
}

@Composable
private fun ChatDestructiveDialogHost(
    dialog: ChatDestructiveDialog,
    onDismiss: () -> Unit,
    onClear: () -> Unit,
    onDelete: () -> Unit,
) {
    when (dialog) {
        ChatDestructiveDialog.ClearHistory ->
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text(stringResource(R.string.chat_clear_history_title)) },
                text = { Text(stringResource(R.string.chat_clear_history_body)) },
                confirmButton = {
                    TextButton(onClick = onClear) {
                        Text(
                            stringResource(R.string.chat_clear),
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.chat_cancel))
                    }
                },
            )
        ChatDestructiveDialog.DeleteChat ->
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text(stringResource(R.string.chat_delete_title)) },
                text = { Text(stringResource(R.string.chat_delete_body)) },
                confirmButton = {
                    TextButton(onClick = onDelete) {
                        Text(
                            stringResource(R.string.chat_delete),
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.chat_cancel))
                    }
                },
            )
        ChatDestructiveDialog.None -> Unit
    }
}

private fun filterChatsForPane(state: ChatUiState): List<ChatEntity> =
    state.chats
        .filter { chat ->
            val query = state.chatFilter.trim()
            query.isBlank() ||
                chat.chatId.contains(query, ignoreCase = true) ||
                chat.lastMessagePreview.orEmpty().contains(query, ignoreCase = true)
        }
        .filter { chat ->
            val flags = state.chatLocalFlags[chat.chatId] ?: ChatLocalFlags()
            when (state.activeFilterTab) {
                ChatListFilterTab.All -> !flags.archived
                ChatListFilterTab.Unread -> chat.unreadCount > 0 && !flags.archived
                ChatListFilterTab.Pinned -> flags.pinned && !flags.archived
                ChatListFilterTab.Muted -> flags.muted && !flags.archived
                ChatListFilterTab.Archived -> flags.archived
            }
        }
        .sortedForChatList(state.chatLocalFlags)

private enum class ChatDestructiveDialog {
    None,
    ClearHistory,
    DeleteChat,
}
