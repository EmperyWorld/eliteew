/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Internal callback bundles shared by the GAF chat screen shell, list pane, and thread pane.
 * Keeps the public ChatLiteScreen contract stable while focused UI files remain readable.
 *
 * Invariants:
 * - Bundles contain UI callbacks only; repository and API ownership stays in MainViewModel.
 *
 * Related:
 * - ChatFeature.kt, ChatListPane.kt, ChatThreadPane.kt
 */
package feature.chat

internal data class ChatListActions(
    val onOpenChat: (String) -> Unit,
    val onChatFilterChange: (String) -> Unit,
    val onFilterTabChange: (ChatListFilterTab) -> Unit,
    val onTogglePinned: (String) -> Unit,
    val onToggleMuted: (String) -> Unit,
    val onToggleArchived: (String) -> Unit,
    val onSetUserSearchQuery: (String) -> Unit,
    val onSearchUsers: () -> Unit,
    val onOpenOrCreateChatByUsername: (String) -> Unit,
)

internal data class ChatThreadActions(
    val onPickImage: () -> Unit,
    val onPickFile: () -> Unit,
    val onRemoveAttachment: (String) -> Unit,
    val onDraftChange: (String) -> Unit,
    val onSend: () -> Unit,
    val onLoadOlderMessages: () -> Unit,
    val onRetryMessage: (String) -> Unit,
    val onCancelMessage: (String) -> Unit,
    val onStartReply: (String) -> Unit,
    val onCancelReply: () -> Unit,
    val onStartEdit: (String) -> Unit,
    val onCancelEdit: () -> Unit,
    val onDeleteMessage: (String) -> Unit,
    val onOpenAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    val onDownloadAttachment: (chatId: String, messageId: String, fileName: String?) -> Unit,
    val onLoadAttachmentPreview: (chatId: String, messageId: String, fileName: String?) -> Unit,
    val onScheduleImagePreviewPreloads: () -> Unit,
    val onProposeChatE2ee: () -> Unit,
    val onAcceptChatE2ee: () -> Unit,
    val onDeclineChatE2ee: () -> Unit,
    val onDisableChatE2ee: () -> Unit,
)
