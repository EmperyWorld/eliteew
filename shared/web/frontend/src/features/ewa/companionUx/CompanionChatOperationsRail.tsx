/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop companion chat «Текущие операции» rail — wires ``CompanionOperationsPanel`` (U8.3 slice 11).
 *
 * Invariants:
 * - View-only wrapper; parent owns runs polling, focus, and image action handlers.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationsPanel.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { RefObject } from 'react';

import {
	CompanionOperationsPanel,
	type CompanionOperationsPanelProps,
} from '@/features/ewa/companionOperations/CompanionOperationsPanel';
import type { OperationReadyImage } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { requestOpenDesktopApp } from '@/pages/Desktop/utils/desktopDeepLink';

export type CompanionChatOperationsRailProps = {
	principalId: string;
	companionDisplayName: string;
	ru: boolean;
	reducedMotion: boolean;
	operationRuns: EwaCompanionTaskRun[];
	operationsExpanded: boolean;
	onToggleOperationsExpanded: () => void;
	operationsRefreshing: boolean;
	onRefreshOperations: () => void;
	confirmBusyRunId: string | null;
	cancelBusyRunId: string | null;
	onConfirmRun: (runId: string, decision: 'confirm' | 'cancel') => void;
	onCancelRun: (runId: string) => void;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	updateDraft: (text: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	onDownloadImage: (ready: OperationReadyImage) => void;
	onShareImageToGaf: (ready: OperationReadyImage) => void;
	onSendImageToCompanion: (ready: OperationReadyImage) => void;
	highlightedRunId: string | null;
	onRetryPrompt: (prompt: string) => void;
	liveActiveRunIds: ReadonlySet<string>;
	onFocusRun: (runId: string) => void;
	onOpenCompanionPlan?: () => void;
	operationsDisplayLimit: number;
	canLoadMoreHistory: boolean;
	onLoadMoreHistory: () => void;
	loadMoreHistoryBusy: boolean;
	/** Desktop right rail: panel fills aside height; list scrolls inside. */
	fillViewport?: boolean;
	secondaryRailMode?: boolean;
	/** T1 / V-H5: poll/SSE refresh failure — never show live chrome while set. */
	operationsLastErrorKind?: CompanionOperationsPanelProps['operationsLastErrorKind'];
	operationsLastErrorMessage?: CompanionOperationsPanelProps['operationsLastErrorMessage'];
};

export function CompanionChatOperationsRail({
	principalId,
	companionDisplayName,
	ru,
	reducedMotion,
	operationRuns,
	operationsExpanded,
	onToggleOperationsExpanded,
	operationsRefreshing,
	onRefreshOperations,
	confirmBusyRunId,
	cancelBusyRunId,
	onConfirmRun,
	onCancelRun,
	onDispatchActions,
	updateDraft,
	inputRef,
	onDownloadImage,
	onShareImageToGaf,
	onSendImageToCompanion,
	highlightedRunId,
	onRetryPrompt,
	liveActiveRunIds,
	onFocusRun,
	onOpenCompanionPlan,
	operationsDisplayLimit,
	canLoadMoreHistory,
	onLoadMoreHistory,
	loadMoreHistoryBusy,
	fillViewport = false,
	secondaryRailMode = false,
	operationsLastErrorKind = null,
	operationsLastErrorMessage = null,
}: CompanionChatOperationsRailProps) {
	const panelProps: CompanionOperationsPanelProps = {
		principalId,
		operationRuns,
		operationsExpanded,
		onToggleExpanded: onToggleOperationsExpanded,
		operationsRefreshing,
		onRefresh: onRefreshOperations,
		confirmBusyRunId,
		cancelBusyRunId,
		onConfirmRun,
		onCancelRun,
		onPlayTrack: (action) => onDispatchActions([action]),
		onDraftPlayPrompt: (text) => {
			updateDraft(text);
			inputRef.current?.focus({ preventScroll: true });
		},
		onOpenPresentationInEwrp: (jobId) =>
			requestOpenDesktopApp({ appComponent: 'EWRP', ewrpJobId: jobId }),
		onDownloadImage: (ready) => void onDownloadImage(ready),
		onShareImageToGaf: onShareImageToGaf,
		onSendImageToCompanion: (ready) => void onSendImageToCompanion(ready),
		companionDisplayName,
		ru,
		highlightedRunId,
		onRetryPrompt,
		reducedMotion,
		liveActiveRunIds,
		onFocusRun,
		onOpenCompanionPlan,
		operationsDisplayLimit,
		canLoadMoreHistory,
		onLoadMoreHistory,
		loadMoreHistoryBusy,
		fillViewport,
		secondaryRailMode,
		operationsLastErrorKind,
		operationsLastErrorMessage,
	};

	const panel = <CompanionOperationsPanel {...panelProps} />;

	if (!fillViewport) {
		return panel;
	}

	return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{panel}</div>;
}
