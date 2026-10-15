/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat orchestration core slice: auth, chats, messages, send path, and E2EE
 * through mark-read — phase-2 hook completes workspace model assembly.
 *
 * Invariants:
 * - Refs consumed by global keyboard handlers are updated in effects to avoid render-time side effects.
 * - Message/thread state updates preserve scroll behavior and unread markers without forcing full rerenders.
 * - Ordinary chat send path stays default; E2EE branch is used only when backend consent status is active.
 *
 * Related:
 * - GAFChatApp.tsx
 * - hooks/buildGafChatAppWorkspaceModel.ts
 * - components/GafChatAppWorkspace.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */

import { useAuth } from '@/contexts/AuthContext';
import { isUgsAdminAuthorized } from '@/utils/ugsAdminAccess';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopWindowActive } from '../../../context/DesktopWindowActiveContext';
import { useDesktopGafOpenActions } from '../../../context/DesktopGafActionsContext';
import { useSocketConnectionState } from '@/services/communication/socketConnectionStore';
import { useDesktopShellFrame } from '../../../context/DesktopShellFrameContext';
import { gafChatQueryKeys, getE2eeStatus } from '../api/gafChatApi';
import { ensureGafWireIdentityReady } from '../GAFChatCrypto';
import { useGafChatSidebarCollapsed } from './useGafChatSidebarCollapsed';
import {
	useGafChatEnsureMessagesOnSelect,
	useGafChatSidebarList,
} from './useGafChatSidebarList';
import { useGafChatMarkRead } from './useGafChatMarkRead';
import { useGafChatE2eeConsent } from './useGafChatE2eeConsent';
import { useGafChatSendOrchestration } from './useGafChatSendOrchestration';
import {
	useGafChatThreadLifecycleActions,
	type GafChatDeleteMessageMutationHandle,
	type GafChatEditMessageMutationHandle,
} from './useGafChatThreadLifecycleActions';
import { useGafChatShellLayoutClasses } from './useGafChatShellLayoutClasses';
import { useGafChatE2eePlaintext } from './useGafChatE2eePlaintext';
import { useGafChatComposerDraftPersistence } from './useGafChatComposerDraftPersistence';
import { useGafChatSoundPreference } from './useGafChatSoundPreference';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import type { GAFChatAppProps } from '../GAFChatApp';
import {
	gafChatChatsQueryOptions,
	gafChatMeQueryOptions,
} from '../gafChatQueryOptions';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { GAF_CHAT_GUIDE_STEP_DEFS } from '../gafChatGuideConstants';
import { loadPinnedChatOrder } from '../gafChatPinnedChats';
import {
	loadGafChatThreadPrefs,
	saveGafChatThreadPrefs,
	type GafChatThreadPrefs,
} from '../gafChatThreadPrefs';
import { gafChatFocusedChatIdRef } from '../gafChatFocusedChatRef';
import { useGAFUnreadCount } from './useGAFUnreadCount';
import { useGafChatMessages } from './useGafChatMessages';
import { useGafVoiceRecorder } from './useGafVoiceRecorder';
import {
	resolveGafLastMessageIdForRead,
	mergeGafInfinitePages,
} from '../gafChatMessageUtils';
import type { GAFChatListItem, GAFMessageItem } from '../types';

export function useGafChatAppOrchestrationCore({
	initialTargetUsername,
	initialTargetChatId,
	initialComposerAttachment,
	initialComposerSeed,
	professionalWorldsCrossAppLinkId,
}: GAFChatAppProps) {
	const { t } = useTranslation('gafChat');
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		GAF_CHAT_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const chatListRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const inputTextRef = useRef('');
	const editMessageHintId = useId();
	const { data: me } = useQuery({
		...gafChatMeQueryOptions(),
		enabled: !!user,
	});
	const myUserId = me?.user_id ?? null;
	const isGafAdmin = useMemo(
		() =>
			isUgsAdminAuthorized({
				user,
				isAuthenticated: Boolean(user),
				loading: false,
			}),
		[user]
	);

	const { soundEnabled, toggleSound } = useGafChatSoundPreference(me?.user_id);
	const unreadTotal = useGAFUnreadCount(!!user);
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
	useEffect(() => {
		gafChatFocusedChatIdRef.current = selectedChatId;
		return () => {
			if (gafChatFocusedChatIdRef.current === selectedChatId) {
				gafChatFocusedChatIdRef.current = null;
			}
		};
	}, [selectedChatId]);
	const [replyingTo, setReplyingTo] = useState<GAFMessageItem | null>(null);
	const [threadPrefs, setThreadPrefs] = useState<GafChatThreadPrefs>(() =>
		loadGafChatThreadPrefs(null, null)
	);
	const [gafPortalRoot, setGafPortalRoot] = useState<HTMLElement | null>(null);
	const [inputText, setInputText] = useState('');
	useEffect(() => {
		inputTextRef.current = inputText;
	}, [inputText]);
	const [pendingAttachments, setPendingAttachments] = useState<
		GafPendingComposerAttachment[]
	>([]);
	const replyingToRef = useRef<GAFMessageItem | null>(null);
	replyingToRef.current = replyingTo;
	const pendingAttachmentsRef = useRef<GafPendingComposerAttachment[]>([]);
	pendingAttachmentsRef.current = pendingAttachments;
	const [showContentLibraryPicker, setShowContentLibraryPicker] =
		useState(false);
	const [showAdminAppLinkPicker, setShowAdminAppLinkPicker] = useState(false);
	const [attachmentUploading, setAttachmentUploading] = useState(false);
	/** Byte-upload percent (5% steps); null = uploading without byte progress (library). */
	const [attachmentUploadPercent, setAttachmentUploadPercent] = useState<
		number | null
	>(null);
	const [composerDragOver, setComposerDragOver] = useState(false);
	const localAttachInputRef = useRef<HTMLInputElement | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [sidebarFilter, setSidebarFilter] = useState<'all' | 'unread'>('all');
	const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);
	const sidebarSearchInputRef = useRef<HTMLInputElement | null>(null);
	const [showNewChat, setShowNewChat] = useState(false);
	const [partnerLastReadByChat, setPartnerLastReadByChat] = useState<
		Record<string, string | null>
	>({});
	const { connected: socketConnected } = useSocketConnectionState();

	const isDesktopWindowActive = useDesktopWindowActive();
	const shellFrame = useDesktopShellFrame();
	const {
		collapsed: sidebarCollapsed,
		toggle: toggleSidebarCollapsed,
		persisting: sidebarCollapsePersisting,
	} = useGafChatSidebarCollapsed();
	const {
		shellAppToolbarClass,
		shellNavAsideClass,
		shellSidebarSearchRowClass,
		shellSidebarSearchInputClass,
		shellMainColumnClass,
		shellComposerFormClass,
		shellComposerTextareaClass,
		shellComposerHintRowClass,
	} = useGafChatShellLayoutClasses(shellFrame);
	const [chatsErrorDismissed, setChatsErrorDismissed] = useState(false);
	const gafDesktopActions = useDesktopGafOpenActions();
	const [messagesErrorDismissed, setMessagesErrorDismissed] = useState(false);

	const {
		data: chatsData,
		isLoading: chatsLoading,
		error: chatsError,
		refetch: refetchChats,
	} = useQuery({
		...gafChatChatsQueryOptions(),
		enabled: !!user,
		retry: (failureCount, error) => {
			const code = (error as { statusCode?: number })?.statusCode;
			if (code === 401 || code === 403 || code === 404) return false;
			return failureCount < 2;
		},
	});
	const chats = Array.isArray(chatsData) ? chatsData : [];

	const {
		filteredChats,
		filteredChatsRef,
		prefetchChatMessages,
		handleTogglePin,
		handleSelectChat,
	} = useGafChatSidebarList({
		myUserId,
		chats,
		searchQuery,
		sidebarFilter,
		pinnedChatIds,
		setPinnedChatIds,
		selectedChatId,
		setSelectedChatId,
		chatListRowRefs,
	});

	useGafChatEnsureMessagesOnSelect(selectedChatId, queryClient);

	const { data: e2eeStatus } = useQuery({
		queryKey: gafChatQueryKeys.e2eeStatus(selectedChatId),
		queryFn: () => getE2eeStatus(selectedChatId ?? ''),
		enabled: Boolean(user && selectedChatId),
		retry: (failureCount, error) => {
			const code = (error as { statusCode?: number })?.statusCode;
			if (code === 401 || code === 403 || code === 404) return false;
			return failureCount < 2;
		},
	});
	const e2eeActive =
		e2eeStatus?.status === 'active' && Boolean(e2eeStatus?.ready);

	useEffect(() => {
		if (!e2eeActive || !selectedChatId) return;
		void ensureGafWireIdentityReady();
	}, [e2eeActive, selectedChatId]);

	useEffect(() => {
		if (!myUserId) {
			setPinnedChatIds([]);
			return;
		}
		setPinnedChatIds(loadPinnedChatOrder(myUserId));
	}, [myUserId]);

	useGafChatComposerDraftPersistence({
		myUserId,
		selectedChatId,
		inputText,
		inputTextRef,
		setInputText,
		setPendingAttachments,
	});

	useEffect(() => {
		setPartnerLastReadByChat((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const c of chats) {
				const pid = c.partner_last_read_message_id;
				if (pid != null && pid !== '') {
					if (next[c.chat_id] !== pid) {
						next[c.chat_id] = pid;
						changed = true;
					}
				}
			}
			return changed ? next : prev;
		});
	}, [chats]);

	const chatsErrorCode =
		chatsError && 'statusCode' in chatsError
			? (chatsError as { statusCode?: number }).statusCode
			: undefined;

	const chatsErrorSignature =
		chatsError == null
			? ''
			: chatsError instanceof Error
				? chatsError.message
				: String(
						'statusCode' in chatsError
							? ((chatsError as { statusCode?: number }).statusCode ?? '')
							: chatsError
					);
	useEffect(() => {
		setChatsErrorDismissed(false);
		void chatsErrorSignature;
	}, [chatsErrorSignature]);

	const {
		data: messagesInfiniteData,
		isLoading: messagesLoading,
		isError: messagesError,
		error: messagesQueryError,
		refetch: refetchMessages,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useGafChatMessages(selectedChatId);

	const rawMessages = useMemo(
		() => mergeGafInfinitePages(messagesInfiniteData?.pages ?? []),
		[messagesInfiniteData]
	);
	const { messages, setE2eePlaintextByMessageId } = useGafChatE2eePlaintext(
		selectedChatId,
		rawMessages
	);
	const lastMessageIdForRead = useMemo(
		() => resolveGafLastMessageIdForRead(messages, selectedChatId),
		[messages, selectedChatId]
	);

	const messageById = useMemo(
		() => new Map(messages.map((m) => [m.id, m])),
		[messages]
	);

	useEffect(() => {
		if (!myUserId || !selectedChatId) return;
		setThreadPrefs(loadGafChatThreadPrefs(myUserId, selectedChatId));
	}, [myUserId, selectedChatId]);

	const handleThreadPrefsChange = useCallback(
		(next: GafChatThreadPrefs) => {
			setThreadPrefs(next);
			if (myUserId && selectedChatId) {
				saveGafChatThreadPrefs(myUserId, selectedChatId, next);
			}
		},
		[myUserId, selectedChatId]
	);

	useEffect(() => {
		setReplyingTo(null);
	}, []);

	const messagesErrorSignature =
		!messagesError || messagesQueryError == null
			? ''
			: messagesQueryError instanceof Error
				? messagesQueryError.message
				: String(messagesQueryError);
	useEffect(() => {
		setMessagesErrorDismissed(false);
		void messagesErrorSignature;
	}, [messagesErrorSignature]);

	const selectedChatIdRef = useRef<string | null>(null);
	const chatsRef = useRef<GAFChatListItem[]>([]);
	useEffect(() => {
		selectedChatIdRef.current = selectedChatId;
	}, [selectedChatId]);
	useEffect(() => {
		chatsRef.current = chats;
	}, [chats]);

	const selectedChat = useMemo(
		() =>
			selectedChatId
				? chats.find((c) => c.chat_id === selectedChatId)
				: undefined,
		[chats, selectedChatId]
	);
	const partner = selectedChat?.partner;
	const chatBlocked = Boolean(
		partner?.is_blocked || partner?.blocked_by_partner
	);
	const partnerIsSystemAccount = Boolean(partner?.is_system_account);
	const composerLocked = chatBlocked || partnerIsSystemAccount;

	const voiceCompleteBridgeRef = useRef<
		(result: { blob: Blob; mime: string } | null) => void
	>(() => {});

	const editMessageMutationRef = useRef<GafChatEditMessageMutationHandle>({
		mutate: () => {},
		isPending: false,
	});
	const deleteMessageMutationRef = useRef<GafChatDeleteMessageMutationHandle>({
		mutate: () => {},
	});

	const {
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
	} = useGafChatThreadLifecycleActions({
		t,
		selectedChatId,
		setSelectedChatId,
		chatBlocked,
		editMessageMutationRef,
		deleteMessageMutationRef,
	});

	const {
		start: startVoiceRecording,
		stop: stopVoiceRecording,
		cancel: cancelVoiceRecording,
		isRecording: isVoiceRecording,
		elapsedSec: voiceElapsedSec,
		isSupported: isVoiceRecordingSupported,
	} = useGafVoiceRecorder({
		onRecordingComplete: (r) => {
			void voiceCompleteBridgeRef.current(r);
		},
	});

	const {
		sendMutation,
		editMessageMutation,
		deleteMessageMutation,
		acceptBusyMessageId,
		handleSend,
		voiceRecordingCompleteRef,
		handlePickLocalFile,
		handleComposerDragEnter,
		handleComposerDragLeave,
		handleComposerDragOver,
		handleComposerDrop,
		handleComposerPaste,
		handleAcceptIncomingAttachment,
	} = useGafChatSendOrchestration({
		t,
		myUserId,
		selectedChatId,
		e2eeActive,
		chatsRef,
		chats,
		inputText,
		pendingAttachments,
		replyingTo,
		composerLocked,
		professionalWorldsCrossAppLinkId,
		inputRef,
		setInputText,
		setPendingAttachments,
		setReplyingTo,
		setE2eePlaintextByMessageId,
		setAttachmentUploading,
		setAttachmentUploadPercent,
		setComposerDragOver,
		setEditingMessage,
		setEditDraft,
		setMessageDeleteConfirm,
		isVoiceRecording,
		attachmentUploading,
	});

	editMessageMutationRef.current = {
		mutate: editMessageMutation.mutate,
		isPending: editMessageMutation.isPending,
	};
	deleteMessageMutationRef.current = {
		mutate: deleteMessageMutation.mutate,
	};

	voiceCompleteBridgeRef.current = (r) => voiceRecordingCompleteRef.current(r);

	const {
		e2eeConsentBusy,
		handleProposeE2ee,
		handleAcceptE2ee,
		handleDeclineE2ee,
		handleDisableE2ee,
		handleSetupE2eeKeys,
	} = useGafChatE2eeConsent({
		selectedChatId,
		t,
		gafDesktopActions,
	});

	useGafChatMarkRead({
		isDesktopWindowActive,
		selectedChatId,
		messagesLoading,
		messagesLength: messages.length,
		lastMessageIdForRead,
		chats,
		setPartnerLastReadByChat,
	});

	return {
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
		setThreadPrefs,
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
		setAttachmentUploading,
		attachmentUploadPercent,
		setAttachmentUploadPercent,
		composerDragOver,
		setComposerDragOver,
		localAttachInputRef,
		searchQuery,
		setSearchQuery,
		sidebarFilter,
		setSidebarFilter,
		pinnedChatIds,
		setPinnedChatIds,
		sidebarSearchInputRef,
		showNewChat,
		setShowNewChat,
		partnerLastReadByChat,
		setPartnerLastReadByChat,
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
		gafDesktopActions,
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
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		messages,
		setE2eePlaintextByMessageId,
		lastMessageIdForRead,
		messageById,
		handleThreadPrefsChange,
		selectedChatIdRef,
		chatsRef,
		selectedChat,
		partner,
		chatBlocked,
		partnerIsSystemAccount,
		composerLocked,
		voiceCompleteBridgeRef,
		editMessageMutationRef,
		deleteMessageMutationRef,
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
		deleteMessageMutation,
		acceptBusyMessageId,
		handleSend,
		voiceRecordingCompleteRef,
		handlePickLocalFile,
		handleComposerDragEnter,
		handleComposerDragLeave,
		handleComposerDragOver,
		handleComposerDrop,
		handleComposerPaste,
		handleAcceptIncomingAttachment,
		inputRef,
		inputTextRef,
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
		initialTargetUsername,
		initialTargetChatId,
		initialComposerAttachment,
		initialComposerSeed,
		professionalWorldsCrossAppLinkId,
	};
}

export type GafChatAppOrchestrationCoreResult = ReturnType<
	typeof useGafChatAppOrchestrationCore
>;
