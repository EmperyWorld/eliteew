/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composer draft, voice, presets, slash, tools catalog, OCR, and composer section prop assembly.
 *
 * Invariants:
 * - Voice/speak ref bridges are published for transcript submit after voice hooks initialize.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import { type CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { type EwaCompanionQuickPresetsStripProps } from '@/features/ewa/EwaCompanionQuickPresetsStrip';
import type { CompanionComposerSectionProps } from '@/features/ewa/companionUx/CompanionComposerSection';
import type { CompanionComposerShellProps } from '@/features/ewa/companionUx/CompanionComposerShell';
import type { CompanionComposerDraftStackCoreProps } from '@/features/ewa/companionUx/CompanionComposerDraftStack';
import type { CompanionDesktopComposerFooterProps } from '@/features/ewa/companionUx/CompanionDesktopComposerFooter';
import type { CompanionLeftRailComposerToolsSectionProps } from '@/features/ewa/companionUx/CompanionLeftRailComposerToolsSection';
import type { CompanionMobileComposerToolbarProps } from '@/features/ewa/companionUx/CompanionMobileComposerToolbar';
import type { CompanionToolsInstrumentsOverlayProps } from '@/features/ewa/companionUx/CompanionToolsInstrumentsOverlay';
import type { CompanionToolsCatalogPanelProps } from '@/features/ewa/companionTools/CompanionToolsCatalogPanel';
import type { CompanionOcrSourceDialogProps } from '@/features/ewa/companionTools/CompanionOcrSourceDialog';
import { useCompanionOcrInstrument } from '@/features/ewa/companionTools/useCompanionOcrInstrument';
import { useCompanionToolsCatalog } from '@/features/ewa/companionTools/useCompanionToolsCatalog';
import { useCompanionMobileDeepLinkBootstrap } from '@/features/ewa/companionUx/useCompanionMobileDeepLinkBootstrap';
import { matchCompanionSlashCommands } from '@/features/ewa/companionUx/companionSlashCommands';
import { partitionQuickPresetsForCompactUi } from '@/features/ewa/companionQuickPresetsCompactUi';
import { isEwaCompanionVoiceFeatureEnabled } from '@/features/ewa/ewaCompanionVoiceFeature';
import { useEwaCompanionVoiceInput } from '@/features/ewa/useEwaCompanionVoiceInput';
import {
	type EwaCompanionVoiceOutputErrorCode,
	useEwaCompanionVoiceOutput,
} from '@/features/ewa/useEwaCompanionVoiceOutput';
import { useEwaCompanionVoiceSession } from '@/features/ewa/useEwaCompanionVoiceSession';
import { workflowDagBuilderSurface } from '@/features/ewa/companionOutputSurface/CompanionWorkflowEditMode';
import { readPendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import { EWA_COMPANION_CHAT_DRAFT_MAX_LEN } from '@/services/ewa/ewaCompanionChatApi';
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { CompanionChatOrchestrationBaseResult } from '@/features/ewa/companionUx/useCompanionChatOrchestrationBase';
import type { CompanionChatTranscriptBundleResult } from '@/features/ewa/companionUx/useCompanionChatTranscriptBundle';
import type { CompanionChatOperationsBundleResult } from '@/features/ewa/companionUx/useCompanionChatOperationsBundle';
import { useCompanionAutoAcceptTasksToggle } from '@/features/ewa/companionUx/useCompanionAutoAcceptTasksToggle';
import { useCompanionContemplationToggle } from '@/features/ewa/companionUx/useCompanionContemplationToggle';

export type CompanionChatComposerBundleInput = {
	base: CompanionChatOrchestrationBaseResult;
	transcript: CompanionChatTranscriptBundleResult;
	operations: CompanionChatOperationsBundleResult;
};

export function useCompanionChatComposerBundle({
	base,
	transcript,
	operations,
}: CompanionChatComposerBundleInput) {
	const {
		profile,
		reloadProfile,
		t,
		mobileEmbeddedLayout,
		mobileEmbeddedLandscape,
		mobileEmbeddedComposerLayout,
		mobileEdgeRailButtonClass,
		personaId,
		companionPrincipalId,
		inputRef,
		imageInputRef,
		pendingImageRef,
		forceSpeakNextReplyRef,
		submitCompanionLineRef,
		speakCompanionReplyRef,
		stopSpeakingRef,
		openToolsCatalogRef,
		composerRef,
		notifyError,
		draft,
		updateDraft,
		pendingImage,
		setPendingImage,
		pending,
		setPending,
		useWebSearch,
		setUseWebSearch,
		composerVisible,
		slimChatDockVisible,
		handleOutputSurfaceChange,
		leftRail,
		myPhrases,
		onCompanionRevision,
	} = base;

	const { autoAcceptTasks, autoAcceptPending, handleAutoAcceptTasksChange } =
		useCompanionAutoAcceptTasksToggle({
			profile,
			pending,
			reloadProfile,
			onCompanionRevision,
			notifyError,
			t,
		});

	const { contemplationOn, contemplationPending, handleContemplationChange } =
		useCompanionContemplationToggle({
			profile,
			pending,
			reloadProfile,
			onCompanionRevision,
			notifyError,
			t,
		});

	const {
		handleCompanionChatProfileError,
		submitCompanionLine,
		actionsTrayProps,
		displayName,
		handleRestoreLastUserMessage,
		lastRestorableUserMessage,
		quickPresets,
		setPendingTurn,
		lastAssistantReplyText,
	} = transcript;

	const { mobileActiveOperationCount } = operations;

	const { hideMemoryStrip, memoryStrip, setMobileMemoryOpen } = leftRail;

	const {
		savingQuickPreset,
		deletingQuickPresetId,
		renamingQuickPresetId,
		handleSaveQuickPreset,
		handleDeleteQuickPreset,
		handleRenameQuickPreset,
	} = myPhrases;

	const lastVoiceOutErrorToastAtRef = useRef(0);
	const companionVoiceEnabled = isEwaCompanionVoiceFeatureEnabled(profile);
	const [composerExpanded, setComposerExpanded] = useState(false);

	const handleVoiceOutputError = useCallback(
		(code: EwaCompanionVoiceOutputErrorCode) => {
			if (code === 'empty_text') return;
			const now = Date.now();
			if (now - lastVoiceOutErrorToastAtRef.current < 12_000) return;
			lastVoiceOutErrorToastAtRef.current = now;
			notifyError(
				code === 'autoplay_blocked'
					? t('ewaCompanion.voiceOutAutoplayBlocked')
					: t('ewaCompanion.voiceOutFailed')
			);
		},
		[notifyError, t]
	);

	const {
		state: voiceInputState,
		error: voiceInputError,
		isBusy: voiceInputBusy,
		startRecording: startVoiceRecording,
		stopRecordingAndTranscribe,
		clearError: clearVoiceInputError,
	} = useEwaCompanionVoiceInput(companionVoiceEnabled);

	const {
		enabled: voiceOutEnabled,
		setEnabled: setVoiceOutEnabled,
		state: voiceOutputState,
		isBusy: voiceOutputBusy,
		speakAssistantReply,
		stopSpeaking,
	} = useEwaCompanionVoiceOutput(personaId, profile.principal_id, {
		featureEnabled: companionVoiceEnabled,
		onError: handleVoiceOutputError,
	});

	const speakCompanionReply = useCallback(
		(reply: string) => {
			const force = forceSpeakNextReplyRef.current;
			forceSpeakNextReplyRef.current = false;
			void speakAssistantReply(reply, { force });
		},
		[forceSpeakNextReplyRef, speakAssistantReply]
	);

	useEffect(() => {
		speakCompanionReplyRef.current = speakCompanionReply;
	});

	useEffect(() => {
		stopSpeakingRef.current = stopSpeaking;
	});

	const {
		active: voiceSessionActive,
		phase: voiceSessionPhase,
		enterSession: enterVoiceSession,
		exitSession: exitVoiceSession,
		handleSessionMicClick,
		sessionMicDisabled,
	} = useEwaCompanionVoiceSession({
		featureEnabled: companionVoiceEnabled,
		pending,
		voiceInputState,
		voiceOutputState,
		voiceOutputBusy,
		voiceOutEnabled,
		setVoiceOutEnabled,
		startRecording: startVoiceRecording,
		stopRecordingAndTranscribe,
		stopSpeaking,
		onBeforeForceSpeak: () => {
			forceSpeakNextReplyRef.current = true;
		},
		onSendUtterance: (text) => submitCompanionLineRef.current(text),
	});

	const {
		ocrSourceOpen,
		setOcrSourceOpen,
		ocrContentPickerOpen,
		setOcrContentPickerOpen,
		ocrBusy,
		ocrFileInputRef,
		handleOcrLocalFileSelected,
		handleOcrContentPicked,
	} = useCompanionOcrInstrument({
		setPending,
		setPendingTurn,
		speakCompanionReply,
		onCompanionRevision,
		handleCompanionChatProfileError,
		notifyError,
		t,
	});

	const {
		toolsCatalogOpen,
		setToolsCatalogOpen,
		pinnedToolIds,
		setPinnedToolIds,
		catalogRecentToolIds,
		applyQuickPreset,
		handleTryTool,
		handleInsertTool,
	} = useCompanionToolsCatalog({
		principalId: profile.principal_id,
		learnedPreferences: profile.learned_preferences,
		pending,
		ocrBusy,
		updateDraft,
		inputRef,
		submitLineRef: submitCompanionLineRef,
		onOpenOcrSource: () => setOcrSourceOpen(true),
		onOpenMusicWizard: () =>
			handleOutputSurfaceChange({ mode: 'music_xl_base_wizard' }),
	});

	useEffect(() => {
		openToolsCatalogRef.current = () => setToolsCatalogOpen(true);
	});

	useCompanionMobileDeepLinkBootstrap({
		mobileEmbeddedLayout,
		focusOperationRun: operations.focusOperationRun,
		onOpenToolsCatalog: () => setToolsCatalogOpen(true),
		onOpenMyPhrases: () => handleOutputSurfaceChange({ mode: 'my_phrases' }),
		onOpenWorkflowEdit: () =>
			handleOutputSurfaceChange({ mode: 'workflow_edit' }),
	});

	const pinnedQuickPresets = useMemo(
		() =>
			pinnedToolIds
				.map((id) => quickPresets.find((row) => row.id === id))
				.filter((row): row is CompanionQuickPresetChip => Boolean(row)),
		[pinnedToolIds, quickPresets]
	);

	const slashSuggestions = useMemo(
		() => matchCompanionSlashCommands(draft),
		[draft]
	);

	const toolsCatalogCount = useMemo(() => {
		return partitionQuickPresetsForCompactUi(quickPresets).suggested.length;
	}, [quickPresets]);

	useEffect(() => {
		if (!voiceInputError) return;
		const msg =
			voiceInputError === 'mic_permission_denied'
				? t('ewaCompanion.voiceInputMicDenied')
				: voiceInputError === 'mic_empty_transcript'
					? t('ewaCompanion.voiceInputEmpty')
					: t('ewaCompanion.voiceInputFailed');
		notifyError(msg);
		clearVoiceInputError();
	}, [clearVoiceInputError, notifyError, t, voiceInputError]);

	const handleVoiceMicClick = useCallback(async () => {
		if (!companionVoiceEnabled) return;
		if (voiceSessionActive) return;
		if (pending) return;
		if (voiceInputState === 'transcribing' || voiceOutputBusy) return;

		if (voiceInputState === 'recording') {
			const text = await stopRecordingAndTranscribe();
			if (text) {
				const merged = draft.trim() ? `${draft.trimEnd()}\n${text}` : text;
				updateDraft(merged.slice(0, EWA_COMPANION_CHAT_DRAFT_MAX_LEN));
				forceSpeakNextReplyRef.current = true;
				inputRef.current?.focus();
			}
			return;
		}

		stopSpeaking();
		await startVoiceRecording();
	}, [
		companionVoiceEnabled,
		draft,
		pending,
		startVoiceRecording,
		stopRecordingAndTranscribe,
		updateDraft,
		voiceInputState,
		voiceSessionActive,
		stopSpeaking,
		voiceOutputBusy,
		forceSpeakNextReplyRef,
		inputRef,
	]);

	const handleVoiceSpeakerClick = useCallback(() => {
		if (!companionVoiceEnabled) return;
		if (voiceOutputState !== 'idle') {
			stopSpeaking();
			return;
		}
		const next = !voiceOutEnabled;
		setVoiceOutEnabled(next);
		if (next && lastAssistantReplyText) {
			void speakAssistantReply(lastAssistantReplyText, { force: true });
		}
	}, [
		companionVoiceEnabled,
		lastAssistantReplyText,
		setVoiceOutEnabled,
		speakAssistantReply,
		stopSpeaking,
		voiceOutEnabled,
		voiceOutputState,
	]);

	const handleImageFileChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			event.target.value = '';
			if (!file || pending) return;
			try {
				const next = await readPendingCompanionImage(file);
				setPendingImage((prev) => {
					if (prev?.previewUrl) {
						URL.revokeObjectURL(prev.previewUrl);
					}
					return next;
				});
			} catch (err) {
				const code = err instanceof Error ? err.message : '';
				if (code === 'companion_chat_image_unsupported_format') {
					notifyError(t('ewaCompanion.chatImageUnsupportedFormat'));
				} else {
					notifyError(t('ewaCompanion.chatImageTooLarge'));
				}
			}
		},
		[pending, notifyError, setPendingImage, t]
	);

	const handleSend = useCallback(async () => {
		setComposerExpanded(false);
		const text = draft.trim();
		const image = pendingImageRef.current;
		if ((!text && !image) || pending) return;
		await submitCompanionLine(text);
	}, [draft, pending, pendingImageRef, submitCompanionLine]);

	const slimChatDockProps = useMemo(() => {
		if (!slimChatDockVisible) return null;
		return {
			draft,
			pending,
			inputRef,
			onDraftChange: updateDraft,
			onSubmit: () => {
				void handleSend();
			},
			onBackToChat: () => handleOutputSurfaceChange({ mode: 'chat' }),
		};
	}, [
		slimChatDockVisible,
		draft,
		pending,
		inputRef,
		updateDraft,
		handleSend,
		handleOutputSurfaceChange,
	]);

	const clearPendingImage = base.clearPendingImage;

	const quickPresetsStripProps = useMemo(
		(): EwaCompanionQuickPresetsStripProps => ({
			principalId: companionPrincipalId,
			presets: quickPresets,
			pinnedPresets: pinnedQuickPresets,
			draft,
			pending,
			voiceInputBusy,
			savingQuickPreset,
			deletingQuickPresetId,
			renamingQuickPresetId,
			onApplyPreset: applyQuickPreset,
			onSaveDraft: handleSaveQuickPreset,
			onDeletePreset: handleDeleteQuickPreset,
			onRenamePreset: handleRenameQuickPreset,
			onOpenToolsCatalog: () => setToolsCatalogOpen(true),
			onOpenMyPhrases: () => handleOutputSurfaceChange({ mode: 'my_phrases' }),
			onOpenWorkflowChains: () =>
				handleOutputSurfaceChange({ mode: 'workflow_edit' }),
			onCreateWorkflowChain: () =>
				handleOutputSurfaceChange(workflowDagBuilderSurface()),
			companionDisplayName: displayName,
			variant: 'inline',
			embeddedMobile: mobileEmbeddedComposerLayout,
		}),
		[
			companionPrincipalId,
			quickPresets,
			pinnedQuickPresets,
			draft,
			pending,
			voiceInputBusy,
			savingQuickPreset,
			deletingQuickPresetId,
			renamingQuickPresetId,
			applyQuickPreset,
			handleSaveQuickPreset,
			handleDeleteQuickPreset,
			handleRenameQuickPreset,
			handleOutputSurfaceChange,
			displayName,
			mobileEmbeddedComposerLayout,
			setToolsCatalogOpen,
		]
	);

	const composerDraftStackProps = useMemo(
		(): CompanionComposerDraftStackCoreProps => ({
			inputRef,
			draft,
			pending,
			composerExpanded,
			onComposerExpandedChange: setComposerExpanded,
			onDraftChange: updateDraft,
			onSend: handleSend,
			slashSuggestions,
			voiceSessionActive,
			voiceSessionPhase,
			sessionMicDisabled,
			voiceInputState,
			onSessionMicClick: handleSessionMicClick,
			onExitVoiceSession: exitVoiceSession,
		}),
		[
			inputRef,
			draft,
			pending,
			composerExpanded,
			updateDraft,
			handleSend,
			slashSuggestions,
			voiceSessionActive,
			voiceSessionPhase,
			sessionMicDisabled,
			voiceInputState,
			handleSessionMicClick,
			exitVoiceSession,
		]
	);

	const mobileComposerToolbarProps = useMemo(
		(): CompanionMobileComposerToolbarProps => ({
			buttonClassName: mobileEdgeRailButtonClass,
			pending,
			draftTrimmed: Boolean(draft.trim()),
			useWebSearch,
			webSearchLabel: t('ewaCompanion.webSearchLabel'),
			webSearchTitle: t('ewaCompanion.webSearchTitle'),
			hideMemoryStrip,
			mobileActiveOperationCount,
			memoryStripCount: memoryStrip.length,
			canRestoreLastMessage: Boolean(lastRestorableUserMessage),
			companionVoiceEnabled,
			voiceSessionActive,
			voiceInputBusy,
			voiceInputState,
			voiceOutputState,
			voiceOutEnabled,
			onWebSearchChange: setUseWebSearch,
			onAttachImage: () => imageInputRef.current?.click(),
			onOpenOperations: () => base.setMobileOperationsOpen(true),
			onOpenMemory: () => setMobileMemoryOpen(true),
			onRestoreLastMessage: handleRestoreLastUserMessage,
			onEnterVoiceSession: enterVoiceSession,
			onVoiceSpeakerClick: handleVoiceSpeakerClick,
			onVoiceMicClick: handleVoiceMicClick,
			onSend: handleSend,
		}),
		[
			mobileEdgeRailButtonClass,
			pending,
			draft,
			useWebSearch,
			hideMemoryStrip,
			mobileActiveOperationCount,
			memoryStrip.length,
			lastRestorableUserMessage,
			companionVoiceEnabled,
			voiceSessionActive,
			voiceInputBusy,
			voiceInputState,
			voiceOutputState,
			voiceOutEnabled,
			handleRestoreLastUserMessage,
			enterVoiceSession,
			handleVoiceSpeakerClick,
			handleVoiceMicClick,
			handleSend,
			base.setMobileOperationsOpen,
			setMobileMemoryOpen,
			imageInputRef,
			setUseWebSearch,
			t,
		]
	);

	const leftRailComposerToolsProps = useMemo(
		(): CompanionLeftRailComposerToolsSectionProps => ({
			pending,
			useWebSearch,
			webSearchLabel: t('ewaCompanion.webSearchLabel'),
			webSearchTitle: t('ewaCompanion.webSearchTitle'),
			onWebSearchChange: setUseWebSearch,
			autoAcceptTasks,
			onAutoAcceptTasksChange: (checked) => {
				void handleAutoAcceptTasksChange(checked);
			},
			autoAcceptPending,
			contemplationOn,
			onContemplationChange: (checked) => {
				void handleContemplationChange(checked);
			},
			contemplationPending,
			onAttachImage: () => imageInputRef.current?.click(),
			onOpenToolsCatalog: () => setToolsCatalogOpen(true),
			toolsCatalogCount,
			onOpenMyPhrases: () => handleOutputSurfaceChange({ mode: 'my_phrases' }),
			onOpenWorkflowChains: () =>
				handleOutputSurfaceChange({ mode: 'workflow_edit' }),
			onCreateWorkflowChain: () =>
				handleOutputSurfaceChange(workflowDagBuilderSurface()),
			onCreateDagWorkflowChain: () =>
				handleOutputSurfaceChange(workflowDagBuilderSurface()),
		}),
		[
			pending,
			useWebSearch,
			setUseWebSearch,
			autoAcceptTasks,
			autoAcceptPending,
			handleAutoAcceptTasksChange,
			contemplationOn,
			contemplationPending,
			handleContemplationChange,
			imageInputRef,
			setToolsCatalogOpen,
			toolsCatalogCount,
			handleOutputSurfaceChange,
			t,
		]
	);

	const desktopComposerFooterProps = useMemo(
		(): CompanionDesktopComposerFooterProps => ({
			pending,
			draftTrimmed: Boolean(draft.trim()),
			canRestoreLastMessage: Boolean(lastRestorableUserMessage),
			onRestoreLastMessage: handleRestoreLastUserMessage,
			quickPresetsProps: quickPresetsStripProps,
			companionVoiceEnabled,
			voiceSessionActive,
			voiceInputBusy,
			voiceInputState,
			voiceOutputState,
			voiceOutEnabled,
			onEnterVoiceSession: enterVoiceSession,
			onVoiceSpeakerClick: handleVoiceSpeakerClick,
			onVoiceMicClick: handleVoiceMicClick,
			onSend: handleSend,
		}),
		[
			pending,
			draft,
			lastRestorableUserMessage,
			quickPresetsStripProps,
			companionVoiceEnabled,
			voiceSessionActive,
			voiceInputBusy,
			voiceInputState,
			voiceOutputState,
			voiceOutEnabled,
			handleRestoreLastUserMessage,
			enterVoiceSession,
			handleVoiceSpeakerClick,
			handleVoiceMicClick,
			handleSend,
		]
	);

	const composerShellProps = useMemo(
		(): Omit<CompanionComposerShellProps, 'children'> => ({
			composerRef,
			imageInputRef,
			mobileEmbeddedLayout,
			mobileEmbeddedLandscape,
			pendingImage,
			pending,
			onClearPendingImage: clearPendingImage,
			onImageFileChange: handleImageFileChange,
		}),
		[
			composerRef,
			imageInputRef,
			mobileEmbeddedLayout,
			mobileEmbeddedLandscape,
			pendingImage,
			pending,
			clearPendingImage,
			handleImageFileChange,
		]
	);

	const composerSectionProps = useMemo(
		(): CompanionComposerSectionProps => ({
			composerVisible,
			mobileEmbeddedLandscape,
			mobileEmbeddedComposerLayout,
			actionsTrayProps,
			shellProps: composerShellProps,
			mobileBodyProps: {
				toolbarProps: mobileComposerToolbarProps,
				draftStackProps: composerDraftStackProps,
				quickPresetsStripProps: quickPresetsStripProps,
			},
			desktopBodyProps: {
				draftStackProps: composerDraftStackProps,
				footerProps: desktopComposerFooterProps,
			},
		}),
		[
			composerVisible,
			mobileEmbeddedLandscape,
			mobileEmbeddedComposerLayout,
			actionsTrayProps,
			composerShellProps,
			mobileComposerToolbarProps,
			composerDraftStackProps,
			quickPresetsStripProps,
			desktopComposerFooterProps,
		]
	);

	const handleCloseToolsCatalog = useCallback(
		() => setToolsCatalogOpen(false),
		[setToolsCatalogOpen]
	);

	const toolsCatalogPanelProps = useMemo(
		(): Omit<
			CompanionToolsCatalogPanelProps,
			'variant' | 'anchorRef' | 'embeddedMobile'
		> => ({
			open: toolsCatalogOpen,
			onClose: handleCloseToolsCatalog,
			principalId: companionPrincipalId,
			pinnedToolIds,
			recentToolIds: catalogRecentToolIds,
			onPinnedChange: setPinnedToolIds,
			onTryTool: handleTryTool,
			onInsertTool: handleInsertTool,
		}),
		[
			toolsCatalogOpen,
			handleCloseToolsCatalog,
			companionPrincipalId,
			pinnedToolIds,
			catalogRecentToolIds,
			setPinnedToolIds,
			handleTryTool,
			handleInsertTool,
		]
	);

	const handleCloseOcrSource = useCallback(() => {
		if (ocrBusy) return;
		setOcrSourceOpen(false);
		setOcrContentPickerOpen(false);
	}, [ocrBusy, setOcrSourceOpen, setOcrContentPickerOpen]);

	const handleOcrPickContentManager = useCallback(() => {
		setOcrSourceOpen(false);
		setOcrContentPickerOpen(true);
	}, [setOcrSourceOpen, setOcrContentPickerOpen]);

	const handleOcrPickLocal = useCallback(() => {
		ocrFileInputRef.current?.click();
	}, [ocrFileInputRef]);

	const handleOcrContentPickerClose = useCallback(() => {
		if (ocrBusy) return;
		setOcrContentPickerOpen(false);
		setOcrSourceOpen(true);
	}, [ocrBusy, setOcrContentPickerOpen, setOcrSourceOpen]);

	const ocrDialogProps = useMemo(
		(): CompanionOcrSourceDialogProps => ({
			open: ocrSourceOpen,
			busy: ocrBusy,
			fileInputRef: ocrFileInputRef,
			contentPickerOpen: ocrContentPickerOpen,
			onClose: handleCloseOcrSource,
			onPickLocal: handleOcrPickLocal,
			onPickContentManager: handleOcrPickContentManager,
			onLocalFileSelected: handleOcrLocalFileSelected,
			onContentPicked: handleOcrContentPicked,
			onContentPickerClose: handleOcrContentPickerClose,
		}),
		[
			ocrSourceOpen,
			ocrBusy,
			ocrFileInputRef,
			ocrContentPickerOpen,
			handleCloseOcrSource,
			handleOcrPickLocal,
			handleOcrPickContentManager,
			handleOcrLocalFileSelected,
			handleOcrContentPicked,
			handleOcrContentPickerClose,
		]
	);

	const toolsInstrumentsOverlayProps = useMemo(
		(): CompanionToolsInstrumentsOverlayProps => ({
			mobileEmbeddedComposerLayout,
			showDesktopCatalogBackdrop:
				toolsCatalogOpen && !mobileEmbeddedComposerLayout,
			catalogProps: toolsCatalogPanelProps,
			composerRef,
			ocrDialogProps,
		}),
		[
			mobileEmbeddedComposerLayout,
			toolsCatalogOpen,
			toolsCatalogPanelProps,
			composerRef,
			ocrDialogProps,
		]
	);

	return {
		composerSectionProps,
		slimChatDockProps,
		leftRailComposerToolsProps,
		toolsInstrumentsOverlayProps,
		setPendingImage,
	};
}

export type CompanionChatComposerBundleResult = ReturnType<
	typeof useCompanionChatComposerBundle
>;
