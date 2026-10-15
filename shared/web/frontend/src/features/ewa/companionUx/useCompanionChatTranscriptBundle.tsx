/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transcript turn state, submit pipeline, scroll/pull-refresh, left-rail section props,
 * and transcript/output surface prop assembly for companion chat panel.
 *
 * Invariants:
 * - Submit ref bridge is published for composer/tools after submit hook initializes.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import {
	buildPlanCompleteQuickPresets,
	prependPlanCompleteQuickPresets,
	type CompanionQuickPresetChip,
} from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { CompanionTranscriptChatContent } from '@/features/ewa/companionUx/CompanionTranscriptChatContent';
import { CompanionLeftRailPlanSection } from '@/features/ewa/companionUx/CompanionLeftRailPlanSection';
import { workflowDagBuilderSurface } from '@/features/ewa/companionOutputSurface/CompanionWorkflowEditMode';
import { recordRecentToolId } from '@/features/ewa/companionTools/companionRecentToolsStorage';
import {
	deriveAgenticMissionSummaryItems,
	derivePrimaryCenterMissionSurface,
	isAgenticMissionActiveState,
	isOperationTruthfullyLive,
	type AgenticMissionDisplayState,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { buildCompanionCenterMissionCanvas } from '@/features/ewa/companionUx/buildCompanionCenterMissionCanvas';
import {
	dismissCenterMissionRunId,
	setCenterMissionChromeCollapsed,
} from '@/features/ewa/companionUx/companionCenterMissionViewPrefs';
import {
	buildCompanionActionsTrayProps,
	buildCompanionAnticipationSectionProps,
	buildCompanionLeftRailClusterProps,
	buildCompanionLeftRailMemorySectionProps,
	buildCompanionLeftRailPlanSectionProps,
	buildCompanionLeftRailServerActionsProps,
	buildCompanionOutputSurfaceProps,
	buildCompanionProtocolStripsProps,
	buildCompanionTranscriptChatContentProps,
	buildCompanionTranscriptColumnProps,
	buildCompanionTurnPlanStripProps,
} from '@/features/ewa/companionUx/buildCompanionTranscriptBundleProps';
import { buildCompanionTranscriptMessageListProps } from '@/features/ewa/companionUx/buildCompanionTranscriptMessageListProps';
import { useCompanionChatTranscriptDisplay } from '@/features/ewa/companionUx/useCompanionChatTranscriptDisplay';
import { useCompanionEmptyGatewayHandlers } from '@/features/ewa/companionUx/useCompanionEmptyGatewayHandlers';
import { useCompanionPendingReloadDelay } from '@/features/ewa/companionUx/useCompanionPendingReloadDelay';
import { useCompanionChatSubmit } from '@/features/ewa/companionUx/useCompanionChatSubmit';
import { useCompanionMobilePullRefresh } from '@/features/ewa/companionUx/useCompanionMobilePullRefresh';
import {
	EWA_COMPANION_CHAT_DRAFT_MAX_LEN,
	saveEwaCompanionChatDraft,
} from '@/services/ewa/ewaCompanionChatApi';
import { useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { applyCompanionWorkIntensityToPalette } from '@/features/ewa/companionPresence/companionMoodPalette';
import type { CompanionPresenceCssVars } from '@/features/ewa/companionPresence/companionMoodPalette';
import {
	computeCompanionWorkIntensity,
	isCompanionPresenceAtRest,
	isCompanionWorkChromeActive,
} from '@/features/ewa/companionPresence/companionReactiveChrome';
import { isEwaCompanionReactiveChromeEnabled } from '@/features/ewa/ewaCompanionReactiveChromeFeature';
import type { CompanionChatOrchestrationBaseResult } from '@/features/ewa/companionUx/useCompanionChatOrchestrationBase';
import type { CompanionChatOperationsBundleResult } from '@/features/ewa/companionUx/useCompanionChatOperationsBundle';
import { dismissedCompanionRunIdsFromLifecycle } from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import { useCompanionViewPrefs } from '@/pages/Desktop/shell/useCompanionViewPrefs';

export type CompanionChatTranscriptBundleInput = {
	base: CompanionChatOrchestrationBaseResult;
	operations: CompanionChatOperationsBundleResult;
};

export function useCompanionChatTranscriptBundle({
	base,
	operations,
}: CompanionChatTranscriptBundleInput) {
	const {
		profile,
		reloadProfile,
		onCompanionRevision,
		t,
		reducedMotion,
		isDesktopWindowActive,
		desktopRightRailVisible,
		mobileEmbeddedLayout,
		mobileEmbeddedLandscape,
		personaId,
		companionPrincipalId,
		inputRef,
		pendingImageRef,
		submitCompanionLineRef,
		speakCompanionReplyRef,
		stopSpeakingRef,
		openToolsCatalogRef,
		bottomRef,
		companionScrollEpochRef,
		getSnapshot,
		notifyError,
		setDraft,
		updateDraft,
		pending,
		setPending,
		copiedMessageKey,
		setCopiedMessageKey,
		copyFeedbackTimerRef,
		streamingText,
		setStreamingText,
		turnStage,
		setTurnStage,
		protocolReports,
		toolTrace,
		orchestrationOutcome,
		proactiveSuggestion,
		setProactiveSuggestion,
		outputSurface,
		composerVisible,
		surfacePanelActive,
		documentSurfaceActionsHost,
		handleOutputSurfaceChange,
		syncOutputSurfaceFromResponse,
		handleDocumentSurfaceDraftPrompt,
		applyCompanionDesktopConfigPatchSideEffects,
		applyCompanionProfileReset,
		clearPendingImage,
		leftRail,
		myPhrases,
		memoryForget,
		presencePresentation,
		actionRecords,
		setActionRecords,
		actionsExpanded,
		setActionsExpanded,
		dispatchActions,
		handleUndoAction,
		transformVideo,
		syncProtocolFromResponse,
		focusOperationRun,
		handleOpenCompanionPlan,
	} = base;

	const {
		refreshOperationRuns,
		syncTaskRunSnapshot,
		taskEventHandlers,
		operationRuns,
		operationsRefreshing,
		operationsLastErrorMessage,
		operationsLastErrorKind,
		confirmBusyRunId,
		transcriptProgressItems,
		transcriptWorkflowSummaries,
		handleConfirmOperationRunAction,
		handleTranscriptOpenOperations,
		mobileActiveOperationCount,
	} = operations;
	const agenticMissionSummaries = useMemo(
		() => deriveAgenticMissionSummaryItems(operationRuns, t),
		[operationRuns, t]
	);
	const { lifecycle } = useCompanionViewPrefs(companionPrincipalId);
	const dismissedCenterMissionRunIds = useMemo(
		() => dismissedCompanionRunIdsFromLifecycle(lifecycle),
		[lifecycle]
	);
	const primaryCenterMission = useMemo(() => {
		const picked = derivePrimaryCenterMissionSurface(
			operationRuns,
			t,
			operations.highlightedOperationRunId
		);
		if (!picked) return null;
		if (isOperationTruthfullyLive(picked.displayState)) return picked;
		if (dismissedCenterMissionRunIds.includes(picked.runId)) return null;
		return picked;
	}, [
		dismissedCenterMissionRunIds,
		operationRuns,
		operations.highlightedOperationRunId,
		t,
	]);
	const primaryMissionActive = primaryCenterMission
		? isAgenticMissionActiveState(
				primaryCenterMission.displayState as AgenticMissionDisplayState
			) || isOperationTruthfullyLive(primaryCenterMission.displayState)
		: false;
	const missionChromeCollapsed = useMemo(() => {
		if (!primaryCenterMission) return true;
		if (primaryMissionActive) return false;
		const id = primaryCenterMission.runId.trim();
		if (!id) return true;
		if (lifecycle.expandedMissionIds.includes(id)) return false;
		if (lifecycle.collapsedMissionIds.includes(id)) return true;
		return true;
	}, [lifecycle, primaryCenterMission, primaryMissionActive]);
	const handleDismissCenterMission = useCallback(
		(runId: string) => {
			dismissCenterMissionRunId(
				companionPrincipalId,
				runId,
				dismissedCenterMissionRunIds
			);
		},
		[companionPrincipalId, dismissedCenterMissionRunIds]
	);
	const handleSetMissionChromeCollapsed = useCallback(
		(collapsed: boolean) => {
			const runId = primaryCenterMission?.runId;
			if (!runId) return;
			setCenterMissionChromeCollapsed(companionPrincipalId, runId, collapsed);
		},
		[companionPrincipalId, primaryCenterMission?.runId]
	);
	const visibleAgenticMissionSummaries = useMemo(
		() => (primaryCenterMission ? [] : agenticMissionSummaries),
		[agenticMissionSummaries, primaryCenterMission]
	);
	const showMissionNarrativeWhenEmpty =
		!primaryCenterMission && visibleAgenticMissionSummaries.length > 0;

	const {
		hideMemoryStrip,
		leftRailExpanded,
		toggleLeftRailSection,
		setTurnPlanHintState,
		syncTurnPlanHintFromResponse,
		memoryStrip,
		memoryStripRows,
		recentServerActions,
		recentServerActionLabels,
		turnPlanVisual,
		planStripVisible,
		activePlanBundle,
		planRefreshing,
		completingPlanTaskId,
		archivingPlan,
		planFsmStatus,
		planTaskPartition,
		planGoalsSorted,
		planDisplayProgress,
		refreshActivePlan,
		handleCompletePlanTask,
		handleArchiveActivePlan,
		runTurnPlanContinue,
		anticipationHint,
		dismissAnticipationHint,
	} = leftRail;

	const {
		baseQuickPresets,
		phraseIconOverrides,
		myPhrasesBusy,
		handleRenameQuickPreset,
		handleDeleteQuickPreset,
		handleDuplicateMyPhrase,
		handleReorderMyPhrases,
		handleMyPhraseIconChange,
		handleMyPhrasesExportSuccess,
		handleMyPhrasesExportFailed,
		handleImportMyPhrasesFile,
	} = myPhrases;

	const applyQuickPreset = useCallback(
		(preset: CompanionQuickPresetChip) => {
			const next = preset.promptText.trim();
			if (!next || pending) return;
			recordRecentToolId(companionPrincipalId, preset.id);
			if (preset.builtin) {
				void submitCompanionLineRef.current?.(next);
				return;
			}
			updateDraft(next);
			queueMicrotask(() => inputRef.current?.focus());
		},
		[
			companionPrincipalId,
			inputRef,
			pending,
			submitCompanionLineRef,
			updateDraft,
		]
	);

	const { forgettingMemoryHash, handleMemoryForgetRequest } = memoryForget;

	const { showCompanionTransformVideo } = transformVideo;

	const speakCompanionReply = useCallback(
		(reply: string) => {
			speakCompanionReplyRef.current(reply);
		},
		[speakCompanionReplyRef]
	);

	const {
		displayName,
		paletteStyle,
		presence,
		streamPhase,
		roleLine,
		presenceChipLabel,
		companionMoodChipLabel,
		bond,
		headerRotation,
		arlikaPresence,
		catalogRoleLine,
	} = presencePresentation;

	const reactiveChromeEnabled = isEwaCompanionReactiveChromeEnabled(profile);
	const workIntensity = useMemo(
		() =>
			reactiveChromeEnabled
				? computeCompanionWorkIntensity({
						pending,
						streamPhase,
						activeOperationCount: mobileActiveOperationCount,
					})
				: 0,
		[reactiveChromeEnabled, pending, streamPhase, mobileActiveOperationCount]
	);

	const mergedPaletteStyle = useMemo((): CSSProperties | undefined => {
		if (!paletteStyle) return paletteStyle;
		if (!reactiveChromeEnabled || workIntensity <= 0) {
			return paletteStyle;
		}
		return applyCompanionWorkIntensityToPalette(
			paletteStyle as CompanionPresenceCssVars,
			workIntensity
		) as CSSProperties;
	}, [paletteStyle, reactiveChromeEnabled, workIntensity]);

	const workChromeActive = isCompanionWorkChromeActive(workIntensity);

	const presenceAtRest = isCompanionPresenceAtRest({
		isDesktopWindowActive,
		pending,
		streamPhase,
		workChromeActive,
	});

	const {
		setPendingTurn,
		keyedMessages,
		streamGrowingAssistant,
		empty,
		thinkingHintText,
		lastRestorableUserMessage,
		handleRestoreLastUserMessage,
		copyAssistantReply,
		lastAssistantReplyText,
	} = useCompanionChatTranscriptDisplay({
		profile,
		personaId,
		pending,
		streamingText,
		turnStage,
		headerRotation,
		reducedMotion,
		bottomRef,
		companionScrollEpochRef,
		inputRef,
		setCopiedMessageKey,
		copyFeedbackTimerRef,
		notifyError,
		updateDraft,
		t,
	});

	const pendingReloadDelayed = useCompanionPendingReloadDelay({
		pending,
		streamingText,
	});

	const awaitingConfirmationRuns = useMemo(
		() =>
			operationRuns.filter(
				(run) =>
					(run.status || '').trim().toLowerCase() === 'awaiting_confirmation'
			),
		[operationRuns]
	);
	const blockingConfirmationRun = useMemo(() => {
		const primaryRunId = primaryCenterMission?.runId ?? '';
		const highlightedId = (operations.highlightedOperationRunId || '').trim();
		if (highlightedId) {
			const highlightedAwaiting = awaitingConfirmationRuns.find(
				(run) => run.id === highlightedId && run.id !== primaryRunId
			);
			if (highlightedAwaiting) return highlightedAwaiting;
		}
		return (
			awaitingConfirmationRuns.find((run) => run.id !== primaryRunId) ?? null
		);
	}, [
		awaitingConfirmationRuns,
		operations.highlightedOperationRunId,
		primaryCenterMission?.runId,
	]);

	const { handleCompanionChatProfileError, submitCompanionLine } =
		useCompanionChatSubmit({
			principalId: profile.principal_id,
			pending,
			useWebSearch: base.useWebSearch,
			setUseWebSearch: base.setUseWebSearch,
			setPending,
			setPendingTurn,
			setStreamingText,
			setTurnStage,
			setActionRecords,
			setTurnPlanHintState,
			pendingImageRef,
			getSnapshot,
			dispatchActions,
			syncTurnPlanHintFromResponse,
			syncProtocolFromResponse,
			syncOutputSurfaceFromResponse,
			syncTaskRunSnapshot,
			applyCompanionDesktopConfigPatchSideEffects,
			applyCompanionProfileReset,
			showCompanionTransformVideo,
			speakCompanionReply,
			onCompanionRevision,
			taskEventHandlers,
			updateDraft,
			clearPendingImage,
			reloadProfile,
			refreshOperationRuns,
			refreshActivePlan,
			stopSpeaking: () => stopSpeakingRef.current(),
			notifyError,
			t,
		});

	useEffect(() => {
		submitCompanionLineRef.current = submitCompanionLine;
	});

	const handleMobileCompanionRefresh = useCallback(async () => {
		await reloadProfile();
		await refreshOperationRuns({ silent: true });
		await refreshActivePlan({ silent: true });
	}, [reloadProfile, refreshActivePlan, refreshOperationRuns]);

	const { scrollRef: mobilePullScrollRef, pullIndicator: mobilePullIndicator } =
		useCompanionMobilePullRefresh({
			enabled: mobileEmbeddedLayout && composerVisible && !surfacePanelActive,
			onRefresh: handleMobileCompanionRefresh,
			reducedMotion,
		});

	const shouldRedirectTypingToComposer = useCallback(
		(activeEl: Element | null): boolean => {
			if (!activeEl) return true;
			if (inputRef.current && activeEl === inputRef.current) return false;
			const tag = activeEl.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
				return false;
			if (activeEl.closest('[contenteditable="true"]')) return false;
			if (activeEl.closest('[role="dialog"]')) return false;
			return true;
		},
		[inputRef]
	);

	useEffect(() => {
		if (!isDesktopWindowActive) return;
		if (pending) return;
		if (transformVideo.companionTransformVideoOpen) return;

		const handleKeyDownCapture = (e: KeyboardEvent) => {
			if (e.isComposing || e.key === 'Process') return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (e.key !== 'Backspace' && e.key.length !== 1) return;

			const activeEl = document.activeElement;
			if (!shouldRedirectTypingToComposer(activeEl)) return;

			if (
				activeEl instanceof HTMLButtonElement ||
				activeEl?.getAttribute('role') === 'button'
			) {
				if (e.key === ' ' || e.key === 'Enter') return;
			}
			if (
				activeEl instanceof HTMLAnchorElement &&
				activeEl.href &&
				e.key === 'Enter'
			) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			const ta = inputRef.current;
			if (ta) {
				ta.focus({ preventScroll: true });
			}

			const pid = profile.principal_id;
			if (e.key === 'Backspace') {
				setDraft((prev) => {
					const next = prev.slice(0, -1);
					saveEwaCompanionChatDraft(pid, next);
					return next;
				});
			} else {
				setDraft((prev) => {
					const next = (prev + e.key).slice(
						0,
						EWA_COMPANION_CHAT_DRAFT_MAX_LEN
					);
					saveEwaCompanionChatDraft(pid, next);
					return next;
				});
			}

			queueMicrotask(() => {
				const el = inputRef.current;
				if (el) {
					el.style.height = 'auto';
					el.style.height = `${el.scrollHeight}px`;
				}
			});
		};

		document.addEventListener('keydown', handleKeyDownCapture, true);
		return () =>
			document.removeEventListener('keydown', handleKeyDownCapture, true);
	}, [
		transformVideo.companionTransformVideoOpen,
		isDesktopWindowActive,
		pending,
		profile.principal_id,
		shouldRedirectTypingToComposer,
		inputRef,
		setDraft,
	]);

	const quickPresets = useMemo(() => {
		if (!activePlanBundle?.plan) return baseQuickPresets;
		const planComplete = buildPlanCompleteQuickPresets(
			t,
			planTaskPartition.open
		);
		return prependPlanCompleteQuickPresets(baseQuickPresets, planComplete);
	}, [activePlanBundle?.plan, baseQuickPresets, planTaskPartition.open, t]);

	const transcriptMessageListProps = buildCompanionTranscriptMessageListProps({
		keyedMessages,
		streamGrowingAssistant,
		reducedMotion,
		mobileEmbeddedLayout,
		displayName,
		copiedMessageKey,
		onCopyAssistantReply: copyAssistantReply,
		pending,
		streamingText,
		thinkingHintText,
		transcriptProgressItems,
		transcriptWorkflowSummaries,
		agenticMissionSummaries: visibleAgenticMissionSummaries,
		awaitingConfirmationRuns,
		confirmBusyRunId,
		onFocusOperationRun: focusOperationRun,
		onConfirmOperationRun: handleConfirmOperationRunAction,
		onDispatchActions: dispatchActions,
		onOpenCompanionPlan: handleOpenCompanionPlan,
		pendingReloadDelayed,
		showMissionChrome: !primaryCenterMission,
	});
	const centerMissionCanvas = buildCompanionCenterMissionCanvas({
		primaryCenterMission,
		blockingConfirmationRun,
		operationsLastErrorMessage,
		operationsLastErrorKind,
		operationsRefreshing,
		onRefreshOperationRuns: () => void refreshOperationRuns({ silent: false }),
		confirmBusyRunId,
		onConfirmOperationRun: handleConfirmOperationRunAction,
		onDispatchActions: dispatchActions,
		onDraftPlayPrompt: (text) => {
			updateDraft(text);
			inputRef.current?.focus({ preventScroll: true });
		},
		onOpenCompanionPlan: handleOpenCompanionPlan,
		onDismissMission: handleDismissCenterMission,
		missionChromeCollapsed,
		onSetMissionChromeCollapsed: handleSetMissionChromeCollapsed,
		empty,
		pending,
		streamingText,
		transcriptMessageListProps,
		t,
	});

	const actionsTrayProps = buildCompanionActionsTrayProps({
		records: actionRecords,
		expanded: actionsExpanded,
		onToggleExpanded: () => setActionsExpanded((x) => !x),
		onUndo: handleUndoAction,
		onFocusRun: focusOperationRun,
	});

	const handleAnticipationSuggestedPrompt = useCallback(
		(promptText: string) => {
			dismissAnticipationHint();
			void submitCompanionLine(promptText);
		},
		[dismissAnticipationHint, submitCompanionLine]
	);

	const handleTurnPlanContinue = useCallback(() => {
		runTurnPlanContinue(submitCompanionLine);
	}, [runTurnPlanContinue, submitCompanionLine]);

	const anticipationSectionProps = buildCompanionAnticipationSectionProps({
		hint: anticipationHint,
		onSuggestedPrompt: handleAnticipationSuggestedPrompt,
		onDismiss: dismissAnticipationHint,
	});

	const leftRailServerActionsProps = buildCompanionLeftRailServerActionsProps({
		actions: recentServerActions,
		labels: recentServerActionLabels,
		leftRailExpanded,
		onToggleSection: toggleLeftRailSection,
		reducedMotion,
	});

	const handleProtocolQuickReply = useCallback(
		(chip: string) => void submitCompanionLine(chip),
		[submitCompanionLine]
	);

	const handleDismissProactive = useCallback(
		() => setProactiveSuggestion(null),
		[setProactiveSuggestion]
	);

	const protocolStripsProps = buildCompanionProtocolStripsProps({
		toolTrace,
		protocolReports,
		orchestrationOutcome,
		proactiveSuggestion,
		principalId: companionPrincipalId,
		learnedPreferences: profile.learned_preferences,
		companionRevision: profile.companion_revision,
		onQuickReply: handleProtocolQuickReply,
		onDismissProactive: handleDismissProactive,
	});

	const turnPlanStripProps = buildCompanionTurnPlanStripProps({
		turnPlanVisual,
		pending,
		onContinue: handleTurnPlanContinue,
	});

	const handleRefreshPlan = useCallback(
		() => void refreshActivePlan(),
		[refreshActivePlan]
	);

	const handleCompletePlanTaskAction = useCallback(
		(taskId: string) => void handleCompletePlanTask(taskId),
		[handleCompletePlanTask]
	);

	const handleArchivePlanAction = useCallback(
		() => void handleArchiveActivePlan(),
		[handleArchiveActivePlan]
	);

	const leftRailPlanSectionProps = buildCompanionLeftRailPlanSectionProps({
		visible: planStripVisible,
		activePlanBundle,
		leftRailExpanded,
		onToggleSection: toggleLeftRailSection,
		planFsmStatus,
		planDisplayProgress,
		planRefreshing,
		onRefreshPlan: handleRefreshPlan,
		planGoalsSorted,
		planTaskPartition,
		completingPlanTaskId,
		pending,
		onCompleteTask: handleCompletePlanTaskAction,
		archivingPlan,
		onArchivePlan: handleArchivePlanAction,
		reducedMotion,
	});

	const leftRailMemorySectionProps = buildCompanionLeftRailMemorySectionProps({
		hideMemoryStrip,
		memoryStripCount: memoryStrip.length,
		memoryStripRows,
		memoryRevision: profile.companion_revision,
		moodChipLabel: companionMoodChipLabel,
		forgettingHash: forgettingMemoryHash,
		onForgetRequest: handleMemoryForgetRequest,
		leftRailExpanded,
		onToggleSection: toggleLeftRailSection,
	});

	const leftRailClusterProps = buildCompanionLeftRailClusterProps({
		anticipationProps: anticipationSectionProps,
		serverActionsProps: leftRailServerActionsProps,
		protocolStripsProps,
		turnPlanProps: turnPlanStripProps,
		planSectionProps: leftRailPlanSectionProps,
		memorySectionProps: leftRailMemorySectionProps,
	});

	const {
		handleOpenTools,
		handleOpenWorkflows,
		handleChooseEmptyMissionPrompt,
		handleGatewayStartAgentic,
		handleGatewayCreateMedia,
		handleGatewayAccessDocuments,
	} = useCompanionEmptyGatewayHandlers({
		openToolsCatalogRef,
		handleOutputSurfaceChange,
		updateDraft,
		inputRef,
		t,
	});

	const handleSaveScriptAsWorkflowStep = useCallback(
		(text: string) =>
			handleOutputSurfaceChange(
				workflowDagBuilderSurface(undefined, {
					seedTriggerPhrase: text,
				})
			),
		[handleOutputSurfaceChange]
	);

	const transcriptChatContentProps = buildCompanionTranscriptChatContentProps({
		showOnboardingHints: outputSurface.mode === 'chat' && empty,
		companionPrincipalId,
		onOpenTools: handleOpenTools,
		onOpenWorkflows: handleOpenWorkflows,
		onOpenOperations: handleTranscriptOpenOperations,
		onChooseMissionPrompt: handleChooseEmptyMissionPrompt,
		onStartAgentic: handleGatewayStartAgentic,
		onCreateMedia: handleGatewayCreateMedia,
		onAccessDocuments: handleGatewayAccessDocuments,
		empty,
		showMissionNarrativeWhenEmpty,
		centerMissionCanvas,
		displayName,
		showLatestReplyHint: !empty && !centerMissionCanvas,
		messageListProps: transcriptMessageListProps,
		bottomRef,
		embeddedMobile: mobileEmbeddedLayout,
	});

	const outputSurfaceProps = buildCompanionOutputSurfaceProps({
		surface: outputSurface,
		onSurfaceChange: handleOutputSurfaceChange,
		onDraftPrompt: handleDocumentSurfaceDraftPrompt,
		onSubmitPrompt: submitCompanionLine,
		submittingPrompt: pending,
		documentSurfaceActionsHost: desktopRightRailVisible
			? documentSurfaceActionsHost
			: null,
		companionProfile: profile,
		companionPrincipalId,
		myPhrasesPresets: quickPresets,
		phraseIconOverrides,
		myPhrasesBusy,
		onApplyMyPhrase: applyQuickPreset,
		onRenameMyPhrase: handleRenameQuickPreset,
		onDeleteMyPhrase: handleDeleteQuickPreset,
		onDuplicateMyPhrase: handleDuplicateMyPhrase,
		onReorderMyPhrases: handleReorderMyPhrases,
		onMyPhraseIconChange: handleMyPhraseIconChange,
		onMyPhrasesExportSuccess: handleMyPhrasesExportSuccess,
		onMyPhrasesExportFailed: handleMyPhrasesExportFailed,
		onImportMyPhrasesFile: handleImportMyPhrasesFile,
		onSaveScriptAsWorkflowStep: handleSaveScriptAsWorkflowStep,
		planContent: <CompanionLeftRailPlanSection {...leftRailPlanSectionProps} />,
		chatContent: (
			<CompanionTranscriptChatContent {...transcriptChatContentProps} />
		),
	});

	const transcriptColumnProps = buildCompanionTranscriptColumnProps({
		mobileEmbeddedLayout,
		mobileEmbeddedLandscape,
		surfacePanelActive,
		reducedMotion,
		composerVisible,
		pending,
		streamingText,
		scrollRef: mobileEmbeddedLayout ? mobilePullScrollRef : undefined,
		mobilePullIndicator,
	});

	return {
		pending,
		streamingText,
		dispatchActions,
		displayName,
		paletteStyle: mergedPaletteStyle,
		workChromeActive,
		presenceAtRest,
		hideMemoryStrip,
		handleOpenCompanionPlan,
		handleCompanionChatProfileError,
		submitCompanionLine,
		leftRailClusterProps,
		transcriptColumnProps,
		outputSurfaceProps,
		awaitingConfirmationCount: awaitingConfirmationRuns.length,
		actionsTrayProps,
		presence,
		streamPhase,
		roleLine,
		presenceChipLabel,
		bond,
		handleRestoreLastUserMessage,
		lastRestorableUserMessage,
		quickPresets,
		leftRailPlanSectionProps,
		transcriptChatContentProps,
		setPendingTurn,
		lastAssistantReplyText,
		arlikaPresence,
		companionMoodChipLabel,
		catalogRoleLine,
	};
}

export type CompanionChatTranscriptBundleResult = ReturnType<
	typeof useCompanionChatTranscriptBundle
>;
