/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Task runs, SSE events, operations focus, and operations rail prop assembly for companion chat.
 *
 * Invariants:
 * - Poll/SSE lifecycle follows window surface visibility from glue; no duplicate run fetchers.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 * - src/features/ewa/companionOperations/useCompanionOperationRuns.ts
 */

import {
	countActiveCompanionOperationRuns,
	type OperationReadyImage,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	selectCanLoadMoreOperationsHistory,
	selectOperationsDisplayLimit,
	useCompanionOperationsStore,
	useDisplayOperationRuns,
	useLiveActiveOperationRunIds,
	useOperationsBusyIds,
	useOperationsRefreshing,
	useTranscriptProgressItems,
	useTranscriptWorkflowSummaries,
} from '@/features/ewa/companionOperations/companionOperationsStore';
import { useCompanionOperationRuns } from '@/features/ewa/companionOperations/useCompanionOperationRuns';
import { useCompanionTaskEvents } from '@/features/ewa/companionOperations/useCompanionTaskEvents';
import type { CompanionChatOperationsRailProps } from '@/features/ewa/companionUx/CompanionChatOperationsRail';
import { useCompanionOperationImageActions } from '@/features/ewa/companionUx/useCompanionOperationImageActions';
import { type PendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useMemo,
	type MutableRefObject,
} from 'react';
import type { TFunction } from 'i18next';
import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';

export type CompanionChatOperationsBundleInput = {
	operationsPollEnabled: boolean;
	isDesktopWindowActive: boolean;
	mobileEmbeddedComposerLayout: boolean;
	composerVisible: boolean;
	ru: boolean;
	reducedMotion: boolean;
	principalId: string;
	displayName: string;
	notifyError: (message: string) => void;
	notifySuccess: (message: string) => void;
	t: TFunction<'marketing'>;
	dispatchActions: (actions: CompanionChatAction[]) => void;
	updateDraft: (next: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	submitCompanionLineRef: MutableRefObject<
		(text: string) => void | Promise<void>
	>;
	handleOutputSurfaceChange: (next: CompanionOutputSurfaceState) => void;
	handleOpenCompanionPlan: () => void;
	setPendingImage: Dispatch<SetStateAction<PendingCompanionImage | null>>;
	operationsExpanded: boolean;
	setOperationsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
	highlightedOperationRunId: string | null;
	mobileOperationsOpen: boolean;
	setMobileOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	focusOperationRun: (runId: string) => void;
	handleNewActiveOperationRun: (run: EwaCompanionTaskRun) => void;
};

export type CompanionChatOperationsBundleResult = {
	operationsExpanded: boolean;
	setOperationsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
	highlightedOperationRunId: string | null;
	mobileOperationsOpen: boolean;
	setMobileOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	focusOperationRun: (runId: string) => void;
	operationRuns: ReturnType<typeof useCompanionOperationRuns>['operationRuns'];
	operationsRefreshing: boolean;
	operationsLastErrorMessage: string | null;
	operationsLastErrorKind: ReturnType<
		typeof useCompanionOperationRuns
	>['operationsLastErrorKind'];
	refreshOperationRuns: ReturnType<
		typeof useCompanionOperationRuns
	>['refreshOperationRuns'];
	operationsHistoryExpanded: boolean;
	canLoadMoreOperationsHistory: boolean;
	operationsDisplayLimit: number;
	loadMoreOperationsHistory: () => void;
	confirmBusyRunId: string | null;
	cancelBusyRunId: string | null;
	handleConfirmOperationRun: ReturnType<
		typeof useCompanionOperationRuns
	>['handleConfirmOperationRun'];
	handleCancelOperationRun: ReturnType<
		typeof useCompanionOperationRuns
	>['handleCancelOperationRun'];
	transcriptProgressItems: ReturnType<
		typeof useCompanionOperationRuns
	>['transcriptProgressItems'];
	transcriptWorkflowSummaries: ReturnType<
		typeof useCompanionOperationRuns
	>['transcriptWorkflowSummaries'];
	syncTaskRunSnapshot: ReturnType<
		typeof useCompanionOperationRuns
	>['syncTaskRunSnapshot'];
	taskEventHandlers: ReturnType<
		typeof useCompanionTaskEvents
	>['taskEventHandlers'];
	mobileActiveOperationCount: number;
	liveActiveOperationRunIds: ReadonlySet<string>;
	handleOperationRetryPrompt: (prompt: string) => void;
	handleDownloadGeneratedImage: (ready: OperationReadyImage) => void;
	handleShareGeneratedImageToGaf: (ready: OperationReadyImage) => void;
	handleSendGeneratedImageToCompanion: (ready: OperationReadyImage) => void;
	handleToggleOperationsExpanded: () => void;
	handleRefreshOperations: () => void;
	handleConfirmOperationRunAction: (
		runId: string,
		decision: 'confirm' | 'cancel'
	) => void;
	handleCancelOperationRunAction: (runId: string) => void;
	handleTranscriptOpenOperations: () => void;
	operationsRailProps: CompanionChatOperationsRailProps;
};

export function useCompanionChatOperationsBundle({
	operationsPollEnabled,
	isDesktopWindowActive,
	mobileEmbeddedComposerLayout: _mobileEmbeddedComposerLayout,
	composerVisible: _composerVisible,
	ru,
	reducedMotion,
	principalId,
	displayName,
	notifyError,
	notifySuccess,
	t,
	dispatchActions,
	updateDraft,
	inputRef,
	submitCompanionLineRef,
	handleOutputSurfaceChange,
	handleOpenCompanionPlan,
	setPendingImage,
	operationsExpanded,
	setOperationsExpanded,
	highlightedOperationRunId,
	mobileOperationsOpen,
	setMobileOperationsOpen,
	focusOperationRun,
	handleNewActiveOperationRun,
}: CompanionChatOperationsBundleInput): CompanionChatOperationsBundleResult {
	const {
		refreshOperationRuns,
		loadMoreOperationsHistory,
		handleConfirmOperationRun,
		handleCancelOperationRun,
		syncTaskRunSnapshot,
	} = useCompanionOperationRuns({
		pollEnabled: operationsPollEnabled,
		isDesktopWindowActive,
		notifyError,
		notifySuccess,
		t,
		onDispatchActions: dispatchActions,
		onNewActiveRun: handleNewActiveOperationRun,
	});

	const operationRuns = useDisplayOperationRuns();
	const operationsRefreshing = useOperationsRefreshing();
	const operationsLastErrorMessage = useCompanionOperationsStore(
		(s) => s.operationsLastErrorMessage
	);
	const operationsLastErrorKind = useCompanionOperationsStore(
		(s) => s.operationsLastErrorKind
	);
	const { confirmBusyRunId, cancelBusyRunId } = useOperationsBusyIds();
	const operationsHistoryExpanded = useCompanionOperationsStore(
		(s) => s.operationsHistoryExpanded
	);
	const canLoadMoreOperationsHistory = useCompanionOperationsStore(
		selectCanLoadMoreOperationsHistory
	);
	const operationsDisplayLimit = useCompanionOperationsStore(
		selectOperationsDisplayLimit
	);
	const transcriptProgressItems = useTranscriptProgressItems(t);
	const transcriptWorkflowSummaries = useTranscriptWorkflowSummaries();
	const applyRunsUpdater = useCompanionOperationsStore(
		(s) => s.applyRunsUpdater
	);

	const handleOperationRetryPrompt = useCallback(
		(prompt: string) => {
			void submitCompanionLineRef.current(prompt);
		},
		[submitCompanionLineRef]
	);

	const mobileActiveOperationCount = useMemo(
		() => countActiveCompanionOperationRuns(operationRuns),
		[operationRuns]
	);

	const liveActiveOperationRunIds = useLiveActiveOperationRunIds();

	const { taskEventHandlers } = useCompanionTaskEvents({
		onRunsChange: applyRunsUpdater,
		onRefreshRuns: refreshOperationRuns,
	});

	const {
		handleDownloadGeneratedImage,
		handleShareGeneratedImageToGaf,
		handleSendGeneratedImageToCompanion,
	} = useCompanionOperationImageActions({
		ru,
		notifyError,
		t,
		updateDraft,
		inputRef,
		setPendingImage,
	});

	const handleToggleOperationsExpanded = useCallback(
		() => setOperationsExpanded((x) => !x),
		[setOperationsExpanded]
	);

	const handleRefreshOperations = useCallback(
		() => void refreshOperationRuns(),
		[refreshOperationRuns]
	);

	const handleConfirmOperationRunAction = useCallback(
		(runId: string, decision: 'confirm' | 'cancel') =>
			void handleConfirmOperationRun(runId, decision),
		[handleConfirmOperationRun]
	);

	const handleCancelOperationRunAction = useCallback(
		(runId: string) => void handleCancelOperationRun(runId),
		[handleCancelOperationRun]
	);

	const handleTranscriptOpenOperations = useCallback(() => {
		const runId = transcriptProgressItems[0]?.runId;
		if (runId) {
			focusOperationRun(runId);
			return;
		}
		setOperationsExpanded(true);
		setMobileOperationsOpen(true);
	}, [
		transcriptProgressItems,
		focusOperationRun,
		setOperationsExpanded,
		setMobileOperationsOpen,
	]);

	const handleFocusOperationRun = useCallback(
		(runId: string) => {
			focusOperationRun(runId);
			handleOutputSurfaceChange({ mode: 'chat' });
		},
		[focusOperationRun, handleOutputSurfaceChange]
	);

	const operationsRailProps = useMemo(
		(): CompanionChatOperationsRailProps => ({
			principalId,
			companionDisplayName: displayName,
			ru,
			reducedMotion,
			operationRuns,
			operationsExpanded,
			onToggleOperationsExpanded: handleToggleOperationsExpanded,
			operationsRefreshing,
			onRefreshOperations: handleRefreshOperations,
			confirmBusyRunId,
			cancelBusyRunId,
			onConfirmRun: handleConfirmOperationRunAction,
			onCancelRun: handleCancelOperationRunAction,
			onDispatchActions: dispatchActions,
			updateDraft,
			inputRef,
			onDownloadImage: handleDownloadGeneratedImage,
			onShareImageToGaf: handleShareGeneratedImageToGaf,
			onSendImageToCompanion: handleSendGeneratedImageToCompanion,
			highlightedRunId: highlightedOperationRunId,
			onRetryPrompt: handleOperationRetryPrompt,
			liveActiveRunIds: liveActiveOperationRunIds,
			onFocusRun: handleFocusOperationRun,
			onOpenCompanionPlan: handleOpenCompanionPlan,
			operationsDisplayLimit,
			canLoadMoreHistory: canLoadMoreOperationsHistory,
			onLoadMoreHistory: loadMoreOperationsHistory,
			loadMoreHistoryBusy: operationsRefreshing && operationsHistoryExpanded,
			operationsLastErrorKind,
			operationsLastErrorMessage,
		}),
		[
			principalId,
			displayName,
			ru,
			reducedMotion,
			operationRuns,
			operationsExpanded,
			handleToggleOperationsExpanded,
			operationsLastErrorKind,
			operationsLastErrorMessage,
			operationsRefreshing,
			handleRefreshOperations,
			confirmBusyRunId,
			cancelBusyRunId,
			handleConfirmOperationRunAction,
			handleCancelOperationRunAction,
			dispatchActions,
			updateDraft,
			handleDownloadGeneratedImage,
			handleShareGeneratedImageToGaf,
			handleSendGeneratedImageToCompanion,
			highlightedOperationRunId,
			handleOperationRetryPrompt,
			liveActiveOperationRunIds,
			handleFocusOperationRun,
			handleOpenCompanionPlan,
			operationsDisplayLimit,
			canLoadMoreOperationsHistory,
			loadMoreOperationsHistory,
			operationsHistoryExpanded,
			inputRef,
		]
	);

	return {
		operationsExpanded,
		setOperationsExpanded,
		highlightedOperationRunId,
		mobileOperationsOpen,
		setMobileOperationsOpen,
		focusOperationRun: handleFocusOperationRun,
		operationRuns,
		operationsRefreshing,
		operationsLastErrorMessage,
		operationsLastErrorKind,
		refreshOperationRuns,
		operationsHistoryExpanded,
		canLoadMoreOperationsHistory,
		operationsDisplayLimit,
		loadMoreOperationsHistory,
		confirmBusyRunId,
		cancelBusyRunId,
		handleConfirmOperationRun,
		handleCancelOperationRun,
		transcriptProgressItems,
		transcriptWorkflowSummaries,
		syncTaskRunSnapshot,
		taskEventHandlers,
		mobileActiveOperationCount,
		liveActiveOperationRunIds,
		handleOperationRetryPrompt,
		handleDownloadGeneratedImage,
		handleShareGeneratedImageToGaf,
		handleSendGeneratedImageToCompanion,
		handleToggleOperationsExpanded,
		handleRefreshOperations,
		handleConfirmOperationRunAction,
		handleCancelOperationRunAction,
		handleTranscriptOpenOperations,
		operationsRailProps,
	};
}
