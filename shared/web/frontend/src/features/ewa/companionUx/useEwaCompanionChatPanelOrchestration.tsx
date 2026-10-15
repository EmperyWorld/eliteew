/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin glue hook for EwaCompanionChatPanel — wires base, operations, transcript, composer, and overlays bundles.
 *
 * Invariants:
 * - View shell stays in EwaCompanionChatPanel.tsx; bundle hooks own side effects and memo prop assembly.
 * - Public types EwaCompanionChatPanelOrchestrationProps/Result remain stable for EwaCompanionChatPanel.tsx.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionUx/useCompanionChat*Bundle.ts
 */

export type {
	EwaCompanionChatPanelOrchestrationProps,
	EwaCompanionChatPanelOrchestrationResult,
} from '@/features/ewa/companionUx/companionChatOrchestrationShared';

import type {
	EwaCompanionChatPanelOrchestrationProps,
	EwaCompanionChatPanelOrchestrationResult,
} from '@/features/ewa/companionUx/companionChatOrchestrationShared';
import { useCompanionChatOrchestrationBase } from '@/features/ewa/companionUx/useCompanionChatOrchestrationBase';
import { useCompanionChatOperationsBundle } from '@/features/ewa/companionUx/useCompanionChatOperationsBundle';
import { useCompanionChatTranscriptBundle } from '@/features/ewa/companionUx/useCompanionChatTranscriptBundle';
import { useCompanionChatComposerBundle } from '@/features/ewa/companionUx/useCompanionChatComposerBundle';
import { useCompanionChatOverlaysBundle } from '@/features/ewa/companionUx/useCompanionChatOverlaysBundle';

/** Wires five bundle hooks in dependency order: base → operations → transcript → composer → overlays. */
export function useEwaCompanionChatPanelOrchestration(
	props: EwaCompanionChatPanelOrchestrationProps
): EwaCompanionChatPanelOrchestrationResult {
	const base = useCompanionChatOrchestrationBase(props);

	const operations = useCompanionChatOperationsBundle({
		operationsPollEnabled: base.operationsPollEnabled,
		isDesktopWindowActive: base.isDesktopWindowActive,
		mobileEmbeddedComposerLayout: base.mobileEmbeddedComposerLayout,
		composerVisible: base.composerVisible,
		ru: base.ru,
		reducedMotion: base.reducedMotion,
		principalId: props.profile.principal_id,
		displayName: base.presencePresentation.displayName,
		notifyError: base.notifyError,
		notifySuccess: base.notifySuccess,
		t: base.t,
		dispatchActions: base.dispatchActions,
		updateDraft: base.updateDraft,
		inputRef: base.inputRef,
		submitCompanionLineRef: base.submitCompanionLineRef,
		handleOutputSurfaceChange: base.handleOutputSurfaceChange,
		handleOpenCompanionPlan: base.handleOpenCompanionPlan,
		setPendingImage: base.setPendingImage,
		operationsExpanded: base.operationsExpanded,
		setOperationsExpanded: base.setOperationsExpanded,
		highlightedOperationRunId: base.highlightedOperationRunId,
		mobileOperationsOpen: base.mobileOperationsOpen,
		setMobileOperationsOpen: base.setMobileOperationsOpen,
		focusOperationRun: base.focusOperationRun,
		handleNewActiveOperationRun: base.handleNewActiveOperationRun,
	});

	const transcript = useCompanionChatTranscriptBundle({ base, operations });

	const composer = useCompanionChatComposerBundle({
		base,
		transcript,
		operations,
	});

	const overlays = useCompanionChatOverlaysBundle({
		base,
		transcript,
		operations,
		composer,
	});

	return {
		mobileEmbeddedLayout: base.mobileEmbeddedLayout,
		mobileEmbeddedLandscape: base.mobileEmbeddedLandscape,
		arlikaPresence: transcript.arlikaPresence,
		isDesktopWindowActive: base.isDesktopWindowActive,
		paletteStyle: transcript.paletteStyle,
		workChromeActive: transcript.workChromeActive,
		presenceAtRest: transcript.presenceAtRest,
		presenceHeaderProps: overlays.presenceHeaderProps,
		compactPresenceProps: overlays.compactPresenceProps,
		leftRailClusterProps: {
			...transcript.leftRailClusterProps,
			composerToolsProps: composer.leftRailComposerToolsProps,
		},
		hideMobileEmbeddedMetaRail: base.hideMobileEmbeddedMetaRail,
		hideMemoryStrip: transcript.hideMemoryStrip,
		operationsRailProps: operations.operationsRailProps,
		transcriptColumnProps: transcript.transcriptColumnProps,
		outputSurfaceProps: transcript.outputSurfaceProps,
		composerSectionProps: composer.composerSectionProps,
		slimChatDockProps: composer.slimChatDockProps,
		composerVisible: base.composerVisible,
		mobileActiveOperationCount: operations.mobileActiveOperationCount,
		awaitingConfirmationCount: transcript.awaitingConfirmationCount,
		setMobileOperationsOpen: base.setMobileOperationsOpen,
		documentEditorSurfaceActive: base.documentEditorSurfaceActive,
		desktopRightRailVisible: base.desktopRightRailVisible,
		attachDocumentSurfaceActionsHost: base.attachDocumentSurfaceActionsHost,
		chatPanelStackProps: overlays.chatPanelStackProps,
	};
}
