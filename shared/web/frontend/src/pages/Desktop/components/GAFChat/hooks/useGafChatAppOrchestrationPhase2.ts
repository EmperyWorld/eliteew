/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat orchestration phase-2: thread scroll/search, deep links, video calls,
 * keyboard shortcuts, and final workspace-model field assembly.
 *
 * Invariants:
 * - Composes on useGafChatAppOrchestrationCore snapshot without changing behavior.
 *
 * Related:
 * - useGafChatAppOrchestrationCore.ts
 * - useGafChatAppOrchestration.ts
 */
import type { Content } from '@/components/UnifiedContent/types';
import { startTransition, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getUserDisplayName } from '@/utils/userDisplayName';
import { useGafChatThreadScroll } from './useGafChatThreadScroll';
import { useGafChatThreadSearch } from './useGafChatThreadSearch';
import { useGafChatClipboardActions } from './useGafChatClipboardActions';
import { useGafChatDeepLinkBootstrap } from './useGafChatDeepLinkBootstrap';
import { useGafChatE2eeReadinessBanner } from './useGafChatE2eeReadinessBanner';
import { useGafChatVideoCallActions } from './useGafChatVideoCallActions';
import { useGafChatVoiceComposerActions } from './useGafChatVoiceComposerActions';
import { useGafChatKeyboardShortcuts } from './useGafChatKeyboardShortcuts';
import { useGafChatPartnerReadIndex } from './useGafChatPartnerReadIndex';
import type { GafChatAppOrchestrationResult } from './gafChatAppOrchestrationTypes';
import type { GafChatAppOrchestrationCoreResult } from './useGafChatAppOrchestrationCore';
import type { GAFMessageItem } from '../types';

export function useGafChatAppOrchestrationPhase2(
	core: GafChatAppOrchestrationCoreResult
): GafChatAppOrchestrationResult {
	const {
		user,
		t,
		guideLabels,
		guideSteps,
		guideOpen,
		setGuideOpen,
		queryClient,
		myUserId,
		isGafAdmin,
		soundEnabled,
		toggleSound,
		unreadTotal,
		selectedChatId,
		setSelectedChatId,
		replyingTo,
		setReplyingTo,
		threadPrefs,
		gafPortalRoot,
		setGafPortalRoot,
		inputText,
		setInputText,
		pendingAttachments,
		setPendingAttachments,
		showContentLibraryPicker,
		setShowContentLibraryPicker,
		showAdminAppLinkPicker,
		setShowAdminAppLinkPicker,
		attachmentUploading,
		attachmentUploadPercent,
		composerDragOver,
		localAttachInputRef,
		searchQuery,
		setSearchQuery,
		sidebarFilter,
		setSidebarFilter,
		pinnedChatIds,
		sidebarSearchInputRef,
		showNewChat,
		setShowNewChat,
		partnerLastReadByChat,
		socketConnected,
		isDesktopWindowActive,
		shellFrame,
		sidebarCollapsed,
		toggleSidebarCollapsed,
		sidebarCollapsePersisting,
		shellAppToolbarClass,
		shellNavAsideClass,
		shellSidebarSearchRowClass,
		shellSidebarSearchInputClass,
		shellMainColumnClass,
		shellComposerFormClass,
		shellComposerTextareaClass,
		shellComposerHintRowClass,
		chatsErrorDismissed,
		setChatsErrorDismissed,
		messagesErrorDismissed,
		setMessagesErrorDismissed,
		chatsLoading,
		chatsError,
		refetchChats,
		chats,
		filteredChats,
		filteredChatsRef,
		prefetchChatMessages,
		handleTogglePin,
		handleSelectChat,
		e2eeStatus,
		e2eeActive,
		chatsErrorCode,
		messagesLoading,
		messagesError,
		messagesQueryError,
		refetchMessages,
		hasNextPage,
		isFetchingNextPage,
		messages,
		messageById,
		handleThreadPrefsChange,
		selectedChatIdRef,
		partner,
		chatBlocked,
		partnerIsSystemAccount,
		composerLocked,
		confirmKind,
		setConfirmKind,
		messageDeleteConfirm,
		setMessageDeleteConfirm,
		editingMessage,
		setEditingMessage,
		editDraft,
		setEditDraft,
		editMessageTextareaRef,
		handleClearHistory,
		handleArchiveChat,
		handleDeleteForEveryone,
		executeConfirmedAction,
		handleOpenEditMessage,
		handleMessageDeleteForMe,
		handleMessageDeleteForEveryone,
		handleConfirmMessageDelete,
		handleSaveEditedMessage,
		startVoiceRecording,
		stopVoiceRecording,
		cancelVoiceRecording,
		isVoiceRecording,
		voiceElapsedSec,
		isVoiceRecordingSupported,
		sendMutation,
		editMessageMutation,
		acceptBusyMessageId,
		handleSend,
		handlePickLocalFile,
		handleComposerDragEnter,
		handleComposerDragLeave,
		handleComposerDragOver,
		handleComposerDrop,
		handleComposerPaste,
		handleAcceptIncomingAttachment,
		inputRef,
		replyingToRef,
		pendingAttachmentsRef,
		chatListRowRefs,
		editMessageHintId,
		e2eeConsentBusy,
		handleProposeE2ee,
		handleAcceptE2ee,
		handleDeclineE2ee,
		handleDisableE2ee,
		handleSetupE2eeKeys,
	} = core;

	const {
		messageListRef,
		loadMoreSentinelRef,
		showScrollDown,
		updateMessageListScrollUi,
		scrollMessagesToBottom,
		handleLoadOlder,
		scrollToMessageId,
		handleJumpToMessage,
		onConsumedScrollToMessage,
	} = useGafChatThreadScroll({
		selectedChatId,
		messagesLength: messages.length,
		messagesLoading,
		hasNextPage: Boolean(hasNextPage),
		isFetchingNextPage,
		fetchNextPage: core.fetchNextPage,
	});

	const {
		threadSearchQuery,
		setThreadSearchQuery,
		threadSearchQueryRef,
		threadSearchInputRef,
		threadSearchNavRef,
		threadSearchTrimmed,
		threadMatchIds,
		threadMatchIndex,
		goNextThreadMatch,
		goPrevThreadMatch,
	} = useGafChatThreadSearch({
		selectedChatId,
		messages,
		myUserId,
		messageListRef,
	});

	const { handleCopyMessagePlainText, handleCopyPartnerUsername } =
		useGafChatClipboardActions(t);

	const { resolvingInitialUsername, openingChatTimedOut, handleRetryOpenChat } =
		useGafChatDeepLinkBootstrap({
			t,
			user,
			initialTargetChatId: core.initialTargetChatId,
			initialTargetUsername: core.initialTargetUsername,
			initialComposerAttachment: core.initialComposerAttachment,
			initialComposerSeed: core.initialComposerSeed,
			selectedChatId,
			setSelectedChatId,
			setPendingAttachments,
			setInputText,
			chatsLoading,
			chatsError,
			chatsLength: chats.length,
		});

	const { showE2eeReadinessBanner, onDismissE2eeReadinessBanner } =
		useGafChatE2eeReadinessBanner({
			myUserId,
			selectedChatId,
			partner,
			chatBlocked,
			e2eeStatus,
		});
	const chatMuted = Boolean(partner?.is_muted);

	const {
		groupCallPickerOpen,
		setGroupCallPickerOpen,
		startVideoCallMutation,
		startGroupVideoCallMutation,
		handleStartVideoCall,
		handleStartGroupVideoCall,
		handleConfirmGroupVideoCall,
	} = useGafChatVideoCallActions({
		t,
		selectedChatId,
		chatBlocked,
		partner: partner ?? null,
	});

	const handleContentLibraryPick = useCallback(
		(file: Content) => {
			setShowContentLibraryPicker(false);
			startTransition(() => {
				setPendingAttachments((prev) => [
					...prev,
					{
						contentId: file.id,
						fileName: file.name,
						size: file.file_size,
						mimeType: file.mime_type ?? null,
						kind: 'file',
					},
				]);
			});
		},
		[setPendingAttachments, setShowContentLibraryPicker]
	);

	const { beginVoiceRecording, finishVoiceRecording } =
		useGafChatVoiceComposerActions({
			t,
			selectedChatId,
			composerLocked,
			pendingAttachmentsLength: pendingAttachments.length,
			isVoiceRecording,
			startVoiceRecording,
			stopVoiceRecording,
		});

	useEffect(() => {
		if (
			!selectedChatId ||
			showNewChat ||
			composerLocked ||
			resolvingInitialUsername
		) {
			return;
		}
		const id = requestAnimationFrame(() => {
			inputRef.current?.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(id);
	}, [
		selectedChatId,
		showNewChat,
		composerLocked,
		resolvingInitialUsername,
		inputRef,
	]);

	const handleReply = useCallback(
		(msg: GAFMessageItem) => {
			if (e2eeActive) {
				toast.error(t('e2eeReplyBlocked'));
				return;
			}
			setReplyingTo(msg);
		},
		[e2eeActive, setReplyingTo, t]
	);

	useGafChatKeyboardShortcuts({
		user,
		isDesktopWindowActive,
		selectedChatId,
		setSelectedChatId,
		filteredChatsRef,
		selectedChatIdRef,
		chatListRowRefs,
		inputRef,
		threadSearchInputRef,
		sidebarSearchInputRef,
		editMessageTextareaRef,
		localAttachInputRef,
		threadSearchNavRef,
		threadSearchQueryRef,
		setThreadSearchQuery,
		setInputText,
		setReplyingTo,
		replyingToRef,
		pendingAttachmentsRef,
		setPendingAttachments,
		showNewChat,
		confirmKind,
		messageDeleteConfirm,
		editingMessage,
		showContentLibraryPicker,
		showAdminAppLinkPicker,
		isVoiceRecording,
		composerLocked,
		resolvingInitialUsername,
	});

	const partnerLastReadIndex = useGafChatPartnerReadIndex({
		selectedChatId,
		partnerLastReadByChat,
		messages,
	});

	const meLabel = getUserDisplayName(user) || t('meDisplayNameFallback');

	return {
		user,
		t,
		shellAppToolbarClass,
		shellNavAsideClass,
		shellSidebarSearchRowClass,
		shellSidebarSearchInputClass,
		shellMainColumnClass,
		shellComposerFormClass,
		shellComposerTextareaClass,
		shellComposerHintRowClass,
		shellFrame,
		unreadTotal,
		socketConnected,
		myUserId,
		meLabel,
		isGafAdmin,
		selectedChatId,
		partner,
		partnerIsSystemAccount,
		partnerLastReadIndex,
		chatBlocked,
		chatMuted,
		composerLocked,
		e2eeActive,
		e2eeStatus,
		e2eeConsentBusy,
		showE2eeReadinessBanner,
		chatsLoading,
		chatsError: Boolean(chatsError),
		chatsErrorCode,
		chatsErrorDismissed,
		chats,
		filteredChats,
		searchQuery,
		sidebarFilter,
		sidebarCollapsed,
		sidebarCollapsePersisting,
		pinnedChatIds,
		resolvingInitialUsername,
		openingChatTimedOut,
		messagesLoading,
		messagesError,
		messagesErrorDismissed,
		messagesQueryError,
		messages,
		messageById,
		hasNextPage: Boolean(hasNextPage),
		isFetchingNextPage,
		showScrollDown,
		threadPrefs,
		threadSearchQuery,
		threadSearchTrimmed,
		threadMatchIds,
		threadMatchIndex,
		scrollToMessageId,
		inputText,
		replyingTo,
		pendingAttachments,
		composerDragOver,
		isVoiceRecording,
		isVoiceRecordingSupported,
		voiceElapsedSec,
		attachmentUploading,
		attachmentUploadPercent,
		acceptBusyMessageId,
		soundEnabled,
		showNewChat,
		showContentLibraryPicker,
		showAdminAppLinkPicker,
		groupCallPickerOpen,
		confirmKind,
		messageDeleteConfirm,
		editingMessage,
		editDraft,
		editMessageMutationPending: editMessageMutation.isPending,
		guideOpen,
		guideSteps,
		guideLabels,
		startVideoCallPending: startVideoCallMutation.isPending,
		startGroupVideoCallPending: startGroupVideoCallMutation.isPending,
		groupCallSubmitting: startGroupVideoCallMutation.isPending,
		gafPortalRoot,
		chatListRowRefs,
		sidebarSearchInputRef,
		messageListRef,
		loadMoreSentinelRef,
		threadSearchInputRef,
		localAttachInputRef,
		inputRef,
		editMessageTextareaRef,
		editMessageHintId,
		queryClient,
		toastApi: toast,
		sendMutation,
		setShowNewChat,
		setSelectedChatId,
		setSearchQuery,
		setSidebarFilter,
		setGafPortalRoot,
		setChatsErrorDismissed,
		setMessagesErrorDismissed,
		setInputText,
		setReplyingTo,
		setPendingAttachments,
		setShowContentLibraryPicker,
		setShowAdminAppLinkPicker,
		setGroupCallPickerOpen,
		setConfirmKind,
		setMessageDeleteConfirm,
		setEditingMessage,
		setEditDraft,
		setGuideOpen,
		toggleSidebarCollapsed,
		refetchChats,
		refetchMessages,
		handleSelectChat,
		handleTogglePin,
		prefetchChatMessages,
		handleRetryOpenChat,
		handleThreadPrefsChange,
		handleSetupE2eeKeys,
		handleProposeE2ee,
		handleAcceptE2ee,
		handleDeclineE2ee,
		handleDisableE2ee,
		handleStartVideoCall,
		handleStartGroupVideoCall,
		handleClearHistory,
		handleArchiveChat,
		handleDeleteForEveryone,
		toggleSound,
		handleCopyPartnerUsername,
		handleCopyMessagePlainText,
		updateMessageListScrollUi,
		scrollMessagesToBottom,
		handleLoadOlder,
		onConsumedScrollToMessage,
		setThreadSearchQuery,
		goPrevThreadMatch,
		goNextThreadMatch,
		handleAcceptIncomingAttachment,
		handleReply,
		handleJumpToMessage,
		handleOpenEditMessage,
		handleMessageDeleteForMe,
		handleMessageDeleteForEveryone,
		handleSend,
		handleComposerDragEnter,
		handleComposerDragLeave,
		handleComposerDragOver,
		handleComposerDrop,
		handleComposerPaste,
		handlePickLocalFile,
		cancelVoiceRecording,
		beginVoiceRecording,
		finishVoiceRecording,
		handleContentLibraryPick,
		handleConfirmGroupVideoCall,
		executeConfirmedAction,
		handleConfirmMessageDelete,
		handleSaveEditedMessage,
		onDismissE2eeReadinessBanner,
	};
}
