/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dialogs, transform video, guide modal, mobile sheets, presence chrome, and panel stack overlays.
 *
 * Invariants:
 * - Presence presentation reads pending/streaming from transcript bundle; no duplicate presence hook.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import type { CompanionChatDialogClusterProps } from '@/features/ewa/companionUx/CompanionChatDialogCluster';
import type { CompanionTransformVideoPortalProps } from '@/features/ewa/companionUx/CompanionTransformVideoPortal';
import type { CompanionChatPanelOverlaysProps } from '@/features/ewa/companionUx/CompanionChatPanelOverlays';
import type { CompanionMobileMemorySheetProps } from '@/features/ewa/companionUx/CompanionMobileMemorySheet';
import type { CompanionMobileOperationsSheetProps } from '@/features/ewa/companionUx/CompanionMobileOperationsSheet';
import type { CompanionChatMobileSheetsProps } from '@/features/ewa/companionUx/CompanionChatMobileSheets';
import type { CompanionPresenceCompactBarProps } from '@/features/ewa/companionUx/CompanionPresenceCompactBar';
import type { CompanionPresenceHeaderProps } from '@/features/ewa/companionUx/companionPresenceDisplayTypes';
import type { CompanionChatPanelStackProps } from '@/features/ewa/companionUx/CompanionChatPanelStack';
import type { EwaDesktopGuideModalProps } from '@/features/ewa/EwaDesktopGuideModal';
import { useCompanionArlikaV2SigilToggle } from '@/features/ewa/companionUx/useCompanionArlikaV2SigilToggle';
import { type OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';
import { useCallback, useMemo } from 'react';
import type { CompanionChatOrchestrationBaseResult } from '@/features/ewa/companionUx/useCompanionChatOrchestrationBase';
import type { CompanionChatTranscriptBundleResult } from '@/features/ewa/companionUx/useCompanionChatTranscriptBundle';
import type { CompanionChatOperationsBundleResult } from '@/features/ewa/companionUx/useCompanionChatOperationsBundle';
import type { CompanionChatComposerBundleResult } from '@/features/ewa/companionUx/useCompanionChatComposerBundle';

export type CompanionChatOverlaysBundleInput = {
	base: CompanionChatOrchestrationBaseResult;
	transcript: CompanionChatTranscriptBundleResult;
	operations: CompanionChatOperationsBundleResult;
	composer: CompanionChatComposerBundleResult;
};

export function useCompanionChatOverlaysBundle({
	base,
	transcript,
	operations,
	composer,
}: CompanionChatOverlaysBundleInput) {
	const {
		profile,
		reloadProfile,
		onCompanionRevision,
		t,
		mobileEmbeddedLayout,
		mobileEmbeddedLandscape,
		mobileEmbeddedComposerLayout,
		personaId,
		pending,
		reducedMotion,
		notifyError,
		companionPrincipalId,
		ewaGuideOpen,
		setEwaGuideOpen,
		prepareEwaGuideStep,
		ewaGuideSpotlightLayoutKey,
		myPhrases,
		memoryForget,
		leftRail,
		dispatchActions,
		updateDraft,
		transformVideo,
		desktopRightRailVisible,
	} = base;

	const {
		displayName,
		presence,
		streamPhase,
		roleLine,
		presenceChipLabel,
		bond,
		arlikaPresence,
		companionMoodChipLabel,
		catalogRoleLine,
		awaitingConfirmationCount,
	} = transcript;

	const { toolsInstrumentsOverlayProps } = composer;

	const {
		operationRuns,
		mobileOperationsOpen,
		setMobileOperationsOpen,
		highlightedOperationRunId,
		confirmBusyRunId,
		cancelBusyRunId,
		handleConfirmOperationRunAction,
		handleCancelOperationRunAction,
		handleRefreshOperations,
		operationsRefreshing,
		liveActiveOperationRunIds,
		focusOperationRun,
		handleOperationRetryPrompt,
		handleDownloadGeneratedImage,
		handleShareGeneratedImageToGaf,
		handleSendGeneratedImageToCompanion,
		operationsDisplayLimit,
		canLoadMoreOperationsHistory,
		loadMoreOperationsHistory,
		operationsHistoryExpanded,
		mobileActiveOperationCount,
	} = operations;

	const handleOpenCompanionPlan = transcript.handleOpenCompanionPlan;

	const {
		memoryStripRows,
		mobileMemoryOpen,
		setMobileMemoryOpen,
		hideMemoryStrip,
	} = leftRail;

	const { forgettingMemoryHash, handleMemoryForgetRequest } = memoryForget;

	const {
		quickPresetLabelDialog,
		quickPresetLabelInputRef,
		setQuickPresetLabelDialog,
		closeQuickPresetLabelDialog,
		handleQuickPresetLabelDialogConfirm,
		quickPresetDeleteTarget,
		setQuickPresetDeleteTarget,
		handleQuickPresetDeleteConfirm,
	} = myPhrases;

	const { memoryForgetTarget, cancelMemoryForget, handleMemoryForgetConfirm } =
		memoryForget;

	const {
		companionTransformVideoOpen,
		companionTransformVideoFailed,
		companionTransformVideoLoading,
		companionTransformVideoSrc,
		companionTransformVideoRetry,
		companionTransformVideoNeedsControls,
		companionTransformVideoRef,
		closeCompanionTransformVideo,
		showCompanionTransformVideo,
		handleCompanionTransformVideoReady,
		handleCompanionTransformVideoError,
	} = transformVideo;

	const {
		canToggleArlikaV2Sigil,
		arlikaV2SigilLabel,
		arlikaV2ModeSwitching,
		handleArlikaV2SigilToggle,
	} = useCompanionArlikaV2SigilToggle({
		profile,
		pending,
		reloadProfile,
		onCompanionRevision,
		showCompanionTransformVideo,
		notifyError,
		t,
	});

	const handleQuickPresetLabelValueChange = useCallback(
		(value: string) =>
			setQuickPresetLabelDialog((prev) => (prev ? { ...prev, value } : prev)),
		[setQuickPresetLabelDialog]
	);

	const handleQuickPresetLabelConfirm = useCallback(
		() => void handleQuickPresetLabelDialogConfirm(),
		[handleQuickPresetLabelDialogConfirm]
	);

	const handleCancelQuickPresetDelete = useCallback(
		() => setQuickPresetDeleteTarget(null),
		[setQuickPresetDeleteTarget]
	);

	const handleConfirmQuickPresetDelete = useCallback(
		() => void handleQuickPresetDeleteConfirm(),
		[handleQuickPresetDeleteConfirm]
	);

	const handleConfirmMemoryForget = useCallback(
		() => void handleMemoryForgetConfirm(),
		[handleMemoryForgetConfirm]
	);

	const dialogClusterProps = useMemo(
		(): CompanionChatDialogClusterProps => ({
			quickPresetLabelDialog,
			quickPresetLabelInputRef,
			onQuickPresetLabelValueChange: handleQuickPresetLabelValueChange,
			onCloseQuickPresetLabelDialog: closeQuickPresetLabelDialog,
			onQuickPresetLabelConfirm: handleQuickPresetLabelConfirm,
			quickPresetDeleteTarget,
			onCancelQuickPresetDelete: handleCancelQuickPresetDelete,
			onConfirmQuickPresetDelete: handleConfirmQuickPresetDelete,
			memoryForgetTarget,
			onCancelMemoryForget: cancelMemoryForget,
			onConfirmMemoryForget: handleConfirmMemoryForget,
		}),
		[
			quickPresetLabelDialog,
			quickPresetLabelInputRef,
			handleQuickPresetLabelValueChange,
			closeQuickPresetLabelDialog,
			handleQuickPresetLabelConfirm,
			quickPresetDeleteTarget,
			handleCancelQuickPresetDelete,
			handleConfirmQuickPresetDelete,
			memoryForgetTarget,
			cancelMemoryForget,
			handleConfirmMemoryForget,
		]
	);

	const transformVideoProps = useMemo(
		(): CompanionTransformVideoPortalProps => ({
			open: companionTransformVideoOpen,
			failed: companionTransformVideoFailed,
			loading: companionTransformVideoLoading,
			src: companionTransformVideoSrc,
			retry: companionTransformVideoRetry,
			needsControls: companionTransformVideoNeedsControls,
			videoRef: companionTransformVideoRef,
			onClose: closeCompanionTransformVideo,
			onReady: handleCompanionTransformVideoReady,
			onError: handleCompanionTransformVideoError,
		}),
		[
			companionTransformVideoOpen,
			companionTransformVideoFailed,
			companionTransformVideoLoading,
			companionTransformVideoSrc,
			companionTransformVideoRetry,
			companionTransformVideoNeedsControls,
			companionTransformVideoRef,
			closeCompanionTransformVideo,
			handleCompanionTransformVideoReady,
			handleCompanionTransformVideoError,
		]
	);

	const handleCloseEwaGuide = useCallback(
		() => setEwaGuideOpen(false),
		[setEwaGuideOpen]
	);

	const guideModalProps = useMemo(
		(): EwaDesktopGuideModalProps => ({
			open: ewaGuideOpen,
			onClose: handleCloseEwaGuide,
			onPrepareStep: prepareEwaGuideStep,
			spotlightLayoutKey: ewaGuideSpotlightLayoutKey,
		}),
		[
			ewaGuideOpen,
			handleCloseEwaGuide,
			prepareEwaGuideStep,
			ewaGuideSpotlightLayoutKey,
		]
	);

	const handleArlikaV2SigilToggleAction = useCallback(
		() => void handleArlikaV2SigilToggle(),
		[handleArlikaV2SigilToggle]
	);

	const presenceHeaderProps = useMemo(
		(): CompanionPresenceHeaderProps => ({
			mobileEmbeddedLayout,
			mobileEmbeddedLandscape,
			personaId,
			presence,
			bond,
			streamPhase,
			displayName,
			presenceChipLabel,
			roleLine,
			canToggleArlikaV2Sigil,
			arlikaV2SigilLabel,
			arlikaV2ModeSwitching,
			pending,
			onArlikaV2SigilToggle: handleArlikaV2SigilToggleAction,
			showOperationsEntry: !desktopRightRailVisible,
			activeOperationCount: mobileActiveOperationCount,
			awaitingConfirmationCount,
			onOpenOperations: () => setMobileOperationsOpen(true),
		}),
		[
			mobileEmbeddedLayout,
			mobileEmbeddedLandscape,
			personaId,
			presence,
			bond,
			streamPhase,
			displayName,
			presenceChipLabel,
			roleLine,
			canToggleArlikaV2Sigil,
			arlikaV2SigilLabel,
			arlikaV2ModeSwitching,
			pending,
			handleArlikaV2SigilToggleAction,
			desktopRightRailVisible,
			mobileActiveOperationCount,
			awaitingConfirmationCount,
			setMobileOperationsOpen,
		]
	);

	const compactPresenceProps = useMemo(
		(): CompanionPresenceCompactBarProps => ({
			personaId,
			presence,
			bond,
			streamPhase,
			displayName,
			presenceChipLabel,
			roleLine: catalogRoleLine,
			canToggleArlikaV2Sigil,
			arlikaV2SigilLabel,
			arlikaV2ModeSwitching,
			pending,
			onArlikaV2SigilToggle: handleArlikaV2SigilToggleAction,
			companionPrincipalId,
		}),
		[
			personaId,
			presence,
			bond,
			streamPhase,
			displayName,
			presenceChipLabel,
			catalogRoleLine,
			canToggleArlikaV2Sigil,
			arlikaV2SigilLabel,
			arlikaV2ModeSwitching,
			pending,
			handleArlikaV2SigilToggleAction,
			companionPrincipalId,
		]
	);

	const handleCloseMobileOperations = useCallback(
		() => setMobileOperationsOpen(false),
		[setMobileOperationsOpen]
	);

	const handleCloseMobileMemory = useCallback(
		() => setMobileMemoryOpen(false),
		[setMobileMemoryOpen]
	);

	const handleMobileSheetPlayTrack = useCallback(
		(action: CompanionChatAction) => dispatchActions([action]),
		[dispatchActions]
	);

	const handleOpenPresentationInEwrp = useCallback(
		(jobId: string) =>
			requestOpenDesktopApp({ appComponent: 'EWRP', ewrpJobId: jobId }),
		[]
	);

	const handleMobileSheetDownloadImage = useCallback(
		(ready: OperationReadyImage) => void handleDownloadGeneratedImage(ready),
		[handleDownloadGeneratedImage]
	);

	const handleMobileSheetSendImage = useCallback(
		(ready: OperationReadyImage) =>
			void handleSendGeneratedImageToCompanion(ready),
		[handleSendGeneratedImageToCompanion]
	);

	const mobileOperationsSheetProps = useMemo(
		(): CompanionMobileOperationsSheetProps => ({
			open: mobileOperationsOpen,
			onClose: handleCloseMobileOperations,
			principalId: profile.principal_id,
			operationRuns,
			ru: base.ru,
			confirmBusyRunId,
			cancelBusyRunId,
			onConfirmRun: handleConfirmOperationRunAction,
			onCancelRun: handleCancelOperationRunAction,
			onPlayTrack: handleMobileSheetPlayTrack,
			onDraftPlayPrompt: updateDraft,
			onOpenPresentationInEwrp: handleOpenPresentationInEwrp,
			onDownloadImage: handleMobileSheetDownloadImage,
			onShareImageToGaf: handleShareGeneratedImageToGaf,
			onSendImageToCompanion: handleMobileSheetSendImage,
			companionDisplayName: displayName,
			highlightedRunId: highlightedOperationRunId,
			onRetryPrompt: handleOperationRetryPrompt,
			onRefresh: handleRefreshOperations,
			refreshing: operationsRefreshing,
			reducedMotion,
			liveActiveRunIds: liveActiveOperationRunIds,
			onFocusRun: focusOperationRun,
			onOpenCompanionPlan: handleOpenCompanionPlan,
			operationsDisplayLimit,
			canLoadMoreHistory: canLoadMoreOperationsHistory,
			onLoadMoreHistory: loadMoreOperationsHistory,
			loadMoreHistoryBusy: operationsRefreshing && operationsHistoryExpanded,
		}),
		[
			mobileOperationsOpen,
			handleCloseMobileOperations,
			profile.principal_id,
			operationRuns,
			base.ru,
			confirmBusyRunId,
			cancelBusyRunId,
			handleConfirmOperationRunAction,
			handleCancelOperationRunAction,
			handleMobileSheetPlayTrack,
			updateDraft,
			handleOpenPresentationInEwrp,
			handleMobileSheetDownloadImage,
			handleShareGeneratedImageToGaf,
			handleMobileSheetSendImage,
			displayName,
			highlightedOperationRunId,
			handleOperationRetryPrompt,
			handleRefreshOperations,
			operationsRefreshing,
			reducedMotion,
			liveActiveOperationRunIds,
			focusOperationRun,
			handleOpenCompanionPlan,
			operationsDisplayLimit,
			canLoadMoreOperationsHistory,
			loadMoreOperationsHistory,
			operationsHistoryExpanded,
		]
	);

	const mobileMemorySheetProps = useMemo(
		(): CompanionMobileMemorySheetProps => ({
			open: mobileMemoryOpen,
			onClose: handleCloseMobileMemory,
			rows: memoryStripRows,
			memoryRevision: profile.companion_revision,
			moodChipLabel: companionMoodChipLabel,
			forgettingHash: forgettingMemoryHash,
			onForgetRequest: handleMemoryForgetRequest,
		}),
		[
			mobileMemoryOpen,
			handleCloseMobileMemory,
			memoryStripRows,
			profile.companion_revision,
			companionMoodChipLabel,
			forgettingMemoryHash,
			handleMemoryForgetRequest,
		]
	);

	const mobileSheetsProps = useMemo(
		(): CompanionChatMobileSheetsProps => ({
			showMemorySheet: mobileEmbeddedComposerLayout && !hideMemoryStrip,
			operationsSheetProps: mobileOperationsSheetProps,
			memorySheetProps: mobileMemorySheetProps,
		}),
		[
			mobileEmbeddedComposerLayout,
			hideMemoryStrip,
			mobileOperationsSheetProps,
			mobileMemorySheetProps,
		]
	);

	const panelOverlaysProps = useMemo(
		(): CompanionChatPanelOverlaysProps => ({
			dialogClusterProps,
			transformVideoProps,
			guideModalProps,
		}),
		[dialogClusterProps, transformVideoProps, guideModalProps]
	);

	const chatPanelStackProps = useMemo(
		(): CompanionChatPanelStackProps => ({
			toolsInstrumentsProps: toolsInstrumentsOverlayProps,
			mobileSheetsProps,
			panelOverlaysProps,
		}),
		[toolsInstrumentsOverlayProps, mobileSheetsProps, panelOverlaysProps]
	);

	return {
		arlikaPresence,
		presenceHeaderProps,
		compactPresenceProps,
		chatPanelStackProps,
	};
}

export type CompanionChatOverlaysBundleResult = ReturnType<
	typeof useCompanionChatOverlaysBundle
>;
