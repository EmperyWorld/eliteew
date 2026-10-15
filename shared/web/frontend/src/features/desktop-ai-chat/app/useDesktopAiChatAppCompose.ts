/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * View-model compose hook: wires existing desktop-ai-chat hooks, shell state, and
 * action handlers for DesktopAiChatApp shell (domain logic stays in hooks/).
 *
 * Invariants:
 * - Stream epoch and chat-scoped prefs must not leak across activeId changes.
 *
 * Related:
 * - app/DesktopAiChatAppView.tsx, hooks/useDesktopAiChat*.ts
 */
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	getDesktopAiChatMe,
	type DesktopAiMessage,
} from '../api/desktopChatClient';
import {
	desktopChatSideLabel,
	heroAvatarPublicPath,
	isDesktopEnsembleChat,
} from '../desktopAiHeroes';
import { DESKTOP_LUCIDE } from '../../../pages/Desktop/constants';
import { useDesktopShellFrame } from '../../../pages/Desktop/context/DesktopShellFrameContext';
import { useEmbeddedPortaledModalZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { isDesktopLowGpuModeEnabled } from '@/pages/Desktop/runtime/desktopLowGpuMode';
import { useDesktopSurfaceLayout } from '../../../pages/Desktop/hooks/useDesktopSurfaceLayout';
import { useDesktopAiChatList } from '../hooks/useDesktopAiChatList';
import { useDesktopAiChatAttachments } from '../hooks/useDesktopAiChatAttachments';
import { useDesktopAiChatEnsemble } from '../hooks/useDesktopAiChatEnsemble';
import { useDesktopAiChatMessages } from '../hooks/useDesktopAiChatMessages';
import { useDesktopAiChatProjects } from '../hooks/useDesktopAiChatProjects';
import { useDesktopAiChatShellStyles } from '../hooks/useDesktopAiChatShellStyles';
import { useDesktopAiChatSoloSlot } from '../hooks/useDesktopAiChatSoloSlot';
import { useDesktopAiChatStream } from '../hooks/useDesktopAiChatStream';
import {
	DESKTOP_AI_CHAT_ME_QUERY_KEY,
	useDesktopAiChatCollab,
} from '../hooks/useDesktopAiChatCollab';
import { useDesktopAiChatRealtime } from '../hooks/useDesktopAiChatRealtime';
import { resolveDesktopChatCapabilities } from '../utils/desktopChatCapabilities';
import { chatDraftKey, persistChatDraft } from '../utils/desktopAiChatDraft';
import {
	buildToolsTooltip,
	resolveDesktopChatModelLabel,
	shellClass,
} from '../utils/desktopAiChatShellHelpers';
import { mergeDesktopAiChatSocketMessage } from '../utils/desktopAiChatSocketMessageMerge';
import type { DesktopAiChatAppProps } from './desktopAiChatAppTypes';
import { useDesktopAiChatAppChromeState } from './useDesktopAiChatAppChromeState';
import { useDesktopAiChatAppPanelPrefs } from './useDesktopAiChatAppPanelPrefs';
import { useDesktopAiChatAppShellActions } from './useDesktopAiChatAppShellActions';
import { useDesktopAiChatAppVoice } from './useDesktopAiChatAppVoice';
import { useDiscussionSession, useDiscussionSetupChatNav } from '../discussion';

export function useDesktopAiChatAppCompose({
	initialChatId,
	initialAttachUnifiedContentId,
	initialAttachSourceLabel,
	initialComposerSeed,
}: DesktopAiChatAppProps) {
	const { t, i18n } = useTranslation('desktopAiChat');
	const {
		surfaceRef,
		isCompact: isCompactSurface,
		isDense: isDenseSurface,
	} = useDesktopSurfaceLayout({
		compactWidth: 1040,
		compactHeight: 720,
		denseWidth: 1240,
		denseHeight: 820,
	});
	const shellTheme = useDesktopShellTheme();
	const lowGpu = React.useMemo(() => isDesktopLowGpuModeEnabled(), []);
	const shellFrame = useDesktopShellFrame();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const lucideStroke = DESKTOP_LUCIDE.stroke;

	const {
		soloSlotStackedModalZ,
		shellNavAsideClass,
		shellMessagesPanelClass,
		shellComposerDockClass,
		shellComposerTextareaClass,
		shellComposerIconBtnClass,
		shellHeaderBarClusterClass,
		shellChatSearchInputClass,
		shellNewChatBtnClass,
		shellComposerStopBtnClass,
		shellHeaderCollapseBtnClass,
	} = useDesktopAiChatShellStyles({ shellFrame, embeddedModalZ });

	const {
		settings,
		chats,
		setChats,
		chatFilter,
		setChatFilter,
		activeId,
		setActiveId,
		activeChat,
		loadingList,
		listLoadState,
		retryListLoad,
		refreshAll,
		chatPins,
		setChatPins,
		titleDraft,
		setTitleDraft,
		titleEditChatId,
		setTitleEditChatId,
		setSoloSlotTariffs,
		filteredChats,
		togglePinChat,
		saveChatTitle,
		cancelTitleEdit,
	} = useDesktopAiChatList({ initialChatId, t });

	const discussionNav = useDiscussionSetupChatNav({
		activeId,
		setActiveId,
	});
	const setActiveIdGuarded = discussionNav.requestSetActiveId;

	const { data: me } = useQuery({
		queryKey: DESKTOP_AI_CHAT_ME_QUERY_KEY,
		queryFn: getDesktopAiChatMe,
		staleTime: 60_000,
	});
	const currentUserId = me?.user_id?.trim() || null;

	const featureOn = settings.feature_enabled !== false;

	const {
		useProjectRag,
		setUseProjectRag,
		projectId,
		projectMenuOpen,
		setProjectMenuOpen,
		projectQuery,
		setProjectQuery,
		projectMenuRef,
		projectSearchInputRef,
		filteredProjects,
		selectedProjectName,
		applyProjectBinding,
	} = useDesktopAiChatProjects({
		activeId,
		chats,
		setChats,
		featureEnabled: featureOn,
		t,
	});

	const [input, setInput] = React.useState('');
	const [sending, setSending] = React.useState(false);

	const {
		messages,
		setMessages,
		messagesTotal,
		messagesLoading,
		messagesLoadState,
		retryLoadMessages,
		messagesLoadingOlder,
		messageListEntries,
		showLoadOlderMessages,
		handleLoadOlderMessages,
		applyTailReplace,
		applyTailMergeAfterStream,
		scrollRef,
		showScrollDown,
		setShowScrollDown,
		stickToBottomRef,
		onMessagesScroll,
		scrollMessagesToBottom,
		assistantContextByMessageId,
		setAssistantContextByMessageId,
		webSearchSourcesByMessageId,
		setWebSearchSourcesByMessageId,
		userMessageDeleteTarget,
		setUserMessageDeleteTarget,
		userMessageDeleteLoading,
		pendingUserMessageDeleteCount,
		truncateUserMessageConfirmed,
	} = useDesktopAiChatMessages({
		activeId,
		setChats,
		sending,
		i18nLanguage: i18n.language,
		t,
	});

	const {
		attachments,
		setAttachments,
		attachRef,
		refreshAttachments,
		onAttach,
		onDropFiles,
		onDragOverFiles,
		warnAttachNeedsChat,
	} = useDesktopAiChatAttachments({
		activeId,
		t,
		initialAttachUnifiedContentId,
		initialAttachSourceLabel,
	});

	const {
		isEnsembleActive,
		ensembleRosterHeroes,
		ensembleRosterSubtitle,
		ensembleRoutingMode,
		ensembleRoutingModeLabel,
		ensembleRoutingMenuRef,
		ensembleRoutingMenuOpen,
		setEnsembleRoutingMenuOpen,
		ensembleDocConfirm,
		setEnsembleDocConfirm,
		ensembleRoutingBusy,
		ensemblePlanCommandsOpen,
		setEnsemblePlanCommandsOpen,
		ensemblePlanCommands,
		ensemblePlanCommandsLoading,
		ensemblePlanCommandsErr,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		defaultEnsembleHeroIds,
		toggleEnsembleHeroPick,
		loadEnsemblePlanCommands,
		applyEnsembleRoutingMode,
		openEnsembleRoutingMenu,
	} = useDesktopAiChatEnsemble({
		activeChat,
		activeId,
		messages,
		settings,
		setChats,
		setProjectMenuOpen,
		t,
	});

	const activeHeroLabel = activeChat
		? desktopChatSideLabel(activeChat.settings)
		: null;
	const assistantHeaderLabel = activeHeroLabel ?? t('defaultAssistant');
	const activeHeroId =
		activeChat &&
		!isDesktopEnsembleChat(activeChat.settings) &&
		typeof activeChat.settings?.desktop_hero_id === 'string'
			? activeChat.settings.desktop_hero_id
			: null;
	const soloSendsBlocked = Boolean(
		activeChat &&
			!isDesktopEnsembleChat(activeChat.settings) &&
			activeChat.solo_slot_active !== true
	);
	const soloCanReleaseConsultant = Boolean(
		activeChat &&
			!isDesktopEnsembleChat(activeChat.settings) &&
			(activeChat.solo_slot_active === true ||
				activeChat.solo_slot_ends_at != null ||
				(typeof activeChat.settings?.desktop_hero_id === 'string' &&
					activeChat.settings.desktop_hero_id.trim() !== ''))
	);

	const solo = useDesktopAiChatSoloSlot({
		activeId,
		setActiveId: setActiveIdGuarded,
		activeChat,
		activeHeroId,
		soloCanReleaseConsultant,
		chats,
		setChats,
		setSoloSlotTariffs,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		defaultEnsembleHeroIds,
		t,
	});

	const chrome = useDesktopAiChatAppChromeState();
	const {
		headerCollapsed,
		setHeaderCollapsed,
		sttBusy,
		setSttBusy,
		toolsHistory,
		setToolsHistory,
		deleteChatConfirmOpen,
		setDeleteChatConfirmOpen,
		deleteChatBusy,
		setDeleteChatBusy,
		streamErrorBanner,
		setStreamErrorBanner,
		streamLockClearBusy,
		setStreamLockClearBusy,
		composerHint,
		setComposerHint,
		ensembleCouncilUi,
		setEnsembleCouncilUi,
		ttsBusy,
		setTtsBusy,
		saveBlueprintToProjectBusyId,
		setSaveBlueprintToProjectBusyId,
		bubbleCtxMenu,
		setBubbleCtxMenu,
		heroDossierOpen,
		setHeroDossierOpen,
		dossierHeroId,
		setDossierHeroId,
		chatGuideOpen,
		setChatGuideOpen,
		chatGuideMountKey,
		setChatGuideMountKey,
		networkOnline,
	} = chrome;

	const discussion = useDiscussionSession(activeId, messages);

	const {
		setPanelPrefsByChatId,
		setPanelPref,
		consumeWebSearchArm,
		useTools,
		useWebSearch,
		voiceIn,
		voiceOut,
	} = useDesktopAiChatAppPanelPrefs(activeId);

	const appliedDesktopAiComposerSeedRef = React.useRef(false);
	const inputRef = React.useRef(input);
	inputRef.current = input;

	const voiceAllowed = settings.voice_enabled !== false;
	const heroIdForDossier = dossierHeroId ?? activeHeroId;
	const activeHeroAvatarPath = heroAvatarPublicPath(activeHeroId);
	const toolsHint = React.useMemo(
		() => buildToolsTooltip(settings, t),
		[settings, t]
	);
	const resolvedModelLabel = React.useMemo(
		() => resolveDesktopChatModelLabel(activeChat, settings, t),
		[activeChat, settings, t]
	);

	const {
		sttMic,
		sttLevelMeterRef,
		sttCancelNextBlobRef,
		skipTtsRef,
		playTts,
	} = useDesktopAiChatAppVoice({
		t,
		activeId,
		activeHeroId,
		voiceOut,
		voiceAllowed,
		setTtsBusy,
	});

	const remoteStreamBusyRef = React.useRef(false);

	const {
		activeIdRef,
		handleSend,
		handleRegenerate,
		handleEnsembleDocumentConfirm,
		handleStopStream,
		handleRetryLastStream,
		abortActiveStream,
	} = useDesktopAiChatStream({
		activeId,
		featureOn,
		sending,
		setSending,
		input,
		setInput,
		messages,
		setMessages,
		chats,
		settings,
		useTools,
		useWebSearch,
		consumeWebSearchArm,
		ensembleDocConfirm,
		setEnsembleDocConfirm,
		soloSendsBlocked,
		setSoloSlotModalOpen: solo.setSoloSlotModalOpen,
		setStreamErrorBanner,
		setComposerHint,
		setShowScrollDown,
		setToolsHistory,
		setEnsembleCouncilUi,
		setAssistantContextByMessageId,
		setWebSearchSourcesByMessageId,
		stickToBottomRef,
		skipTtsRef,
		remoteStreamBusyRef,
		applyTailMergeAfterStream,
		applyTailReplace,
		refreshAttachments,
		playTts,
		currentUserId,
		t,
	});

	const chatCapabilities = React.useMemo(
		() => resolveDesktopChatCapabilities(activeChat),
		[activeChat]
	);

	const streamLockForcePoll =
		streamErrorBanner?.canClearStreamLock === true ||
		streamErrorBanner?.turnBusy === true;

	const collab = useDesktopAiChatCollab({
		t,
		activeId,
		sending,
		streamLockForcePoll,
		currentUserId,
		setChats,
		setActiveId: setActiveIdGuarded,
		setChatPins,
		setPanelPrefsByChatId,
		setInput,
		abortActiveStream,
		refreshAll,
	});

	React.useEffect(() => {
		remoteStreamBusyRef.current = collab.lockedByOther;
	}, [collab.lockedByOther]);

	const handleRemoteMemberChanged = React.useCallback(() => {
		void refreshAll();
		void collab.refreshPendingInvites();
	}, [collab.refreshPendingInvites, refreshAll]);

	const handleRemoteMessage = React.useCallback(
		(message: DesktopAiMessage) => {
			setMessages((prev) => mergeDesktopAiChatSocketMessage(prev, message));
		},
		[setMessages]
	);

	useDesktopAiChatRealtime({
		activeChatId: activeId,
		currentUserId,
		sending,
		armStreamLockPoll: collab.armStreamLockPoll,
		onRemoteTurnDone: retryLoadMessages,
		onMemberChanged: handleRemoteMemberChanged,
		onRemoteMessage: handleRemoteMessage,
	});

	React.useEffect(() => {
		if (streamErrorBanner?.canClearStreamLock || streamErrorBanner?.turnBusy) {
			collab.armStreamLockPoll();
		}
	}, [
		streamErrorBanner?.canClearStreamLock,
		streamErrorBanner?.turnBusy,
		collab.armStreamLockPoll,
	]);

	const streamLockStatusHint = collab.lockedByOther
		? t('collabStreamLockHeldByOther')
		: null;

	const openChatGuideTour = React.useCallback(() => {
		flushSync(() => {
			setChatGuideMountKey((k) => k + 1);
			setChatGuideOpen(true);
		});
	}, [setChatGuideMountKey, setChatGuideOpen]);
	useDesktopGuideTourOpener(openChatGuideTour);

	React.useEffect(() => {
		stickToBottomRef.current = true;
		setShowScrollDown(false);
		if (!activeId) {
			setInput('');
			setAttachments([]);
			return;
		}
		let saved = '';
		try {
			saved = localStorage.getItem(chatDraftKey(activeId)) ?? '';
		} catch {
			/* */
		}
		const seed = initialComposerSeed?.trim();
		if (seed && !appliedDesktopAiComposerSeedRef.current) {
			appliedDesktopAiComposerSeedRef.current = true;
			const s = saved.trim();
			setInput(s ? `${seed}\n\n${s}` : seed);
		} else {
			setInput(saved);
		}
		void refreshAttachments();
		return () => persistChatDraft(activeId, inputRef.current);
	}, [
		activeId,
		refreshAttachments,
		initialComposerSeed,
		setAttachments,
		setShowScrollDown,
		stickToBottomRef,
	]);

	React.useEffect(() => {
		warnAttachNeedsChat(loadingList, chats.length);
	}, [warnAttachNeedsChat, loadingList, chats.length]);

	const shellActions = useDesktopAiChatAppShellActions({
		t,
		i18nLanguage: i18n.language,
		activeId,
		activeChat,
		sending,
		messages,
		streamLockClearBusy,
		voiceAllowed,
		voiceIn,
		sttBusy,
		titleEditChatId,
		webSearchSourcesByMessageId,
		activeIdRef,
		sttMic,
		sttCancelNextBlobRef,
		abortActiveStream,
		setInput,
		setTitleEditChatId,
		setTitleDraft,
		setChatPins,
		setChats,
		setPanelPrefsByChatId,
		setActiveId: setActiveIdGuarded,
		setDeleteChatConfirmOpen,
		setDeleteChatBusy,
		setStreamErrorBanner,
		setStreamLockClearBusy,
		setHeaderCollapsed,
		setSaveBlueprintToProjectBusyId,
		setSttBusy,
	});

	return {
		t,
		i18n,
		surfaceRef,
		isCompactSurface,
		isDenseSurface,
		shellTheme,
		lowGpu,
		shellClass,
		featureOn,
		soloSlotStackedModalZ,
		shellNavAsideClass,
		shellMessagesPanelClass,
		shellComposerDockClass,
		shellComposerTextareaClass,
		shellComposerIconBtnClass,
		shellHeaderBarClusterClass,
		shellChatSearchInputClass,
		shellNewChatBtnClass,
		shellComposerStopBtnClass,
		shellHeaderCollapseBtnClass,
		settings,
		chats,
		chatFilter,
		setChatFilter,
		activeId,
		setActiveId: setActiveIdGuarded,
		activeChat,
		loadingList,
		listLoadState,
		retryListLoad,
		chatPins,
		titleDraft,
		setTitleDraft,
		titleEditChatId,
		setTitleEditChatId,
		filteredChats,
		togglePinChat,
		saveChatTitle,
		cancelTitleEdit,
		useProjectRag,
		setUseProjectRag,
		projectId,
		projectMenuOpen,
		setProjectMenuOpen,
		projectQuery,
		setProjectQuery,
		projectMenuRef,
		projectSearchInputRef,
		filteredProjects,
		selectedProjectName,
		applyProjectBinding,
		input,
		setInput,
		sending,
		messages,
		messagesTotal,
		messagesLoading,
		messagesLoadState,
		retryLoadMessages,
		messagesLoadingOlder,
		messageListEntries,
		showLoadOlderMessages,
		handleLoadOlderMessages,
		scrollRef,
		showScrollDown,
		attachments,
		attachRef,
		onAttach,
		onDropFiles,
		onDragOverFiles,
		isEnsembleActive,
		ensembleRosterHeroes,
		ensembleRosterSubtitle,
		ensembleRoutingMode,
		ensembleRoutingModeLabel,
		ensembleRoutingMenuRef,
		ensembleRoutingMenuOpen,
		setEnsembleRoutingMenuOpen,
		ensembleDocConfirm,
		ensembleRoutingBusy,
		ensemblePlanCommandsOpen,
		setEnsemblePlanCommandsOpen,
		ensemblePlanCommands,
		ensemblePlanCommandsLoading,
		ensemblePlanCommandsErr,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		defaultEnsembleHeroIds,
		toggleEnsembleHeroPick,
		loadEnsemblePlanCommands,
		applyEnsembleRoutingMode,
		openEnsembleRoutingMenu,
		assistantHeaderLabel,
		activeHeroId,
		soloSendsBlocked,
		soloCanReleaseConsultant,
		solo,
		headerCollapsed,
		setPanelPref,
		consumeWebSearchArm,
		useTools,
		useWebSearch,
		voiceIn,
		voiceOut,
		voiceAllowed,
		heroIdForDossier,
		activeHeroAvatarPath,
		toolsHint,
		resolvedModelLabel,
		handleSend,
		handleRegenerate,
		handleEnsembleDocumentConfirm,
		handleStopStream,
		handleRetryLastStream,
		sttBusy,
		ttsBusy,
		sttMic,
		sttLevelMeterRef,
		toolsHistory,
		deleteChatConfirmOpen,
		setDeleteChatConfirmOpen,
		deleteChatBusy,
		streamErrorBanner,
		streamLockClearBusy,
		composerHint,
		ensembleCouncilUi,
		saveBlueprintToProjectBusyId,
		bubbleCtxMenu,
		setBubbleCtxMenu,
		heroDossierOpen,
		setHeroDossierOpen,
		dossierHeroId,
		setDossierHeroId,
		chatGuideOpen,
		setChatGuideOpen,
		chatGuideMountKey,
		setChatGuideMountKey,
		networkOnline,
		discussion,
		discussionNav,
		embeddedModalZ,
		lucideStroke,
		userMessageDeleteTarget,
		setUserMessageDeleteTarget,
		userMessageDeleteLoading,
		pendingUserMessageDeleteCount,
		truncateUserMessageConfirmed,
		assistantContextByMessageId,
		webSearchSourcesByMessageId,
		sttCancelNextBlobRef,
		chatCapabilities,
		currentUserId,
		collab,
		streamLockStatusHint,
		...shellActions,
		onMessagesScroll,
		scrollMessagesToBottom,
	};
}

export type DesktopAiChatAppComposeResult = ReturnType<
	typeof useDesktopAiChatAppCompose
>;
