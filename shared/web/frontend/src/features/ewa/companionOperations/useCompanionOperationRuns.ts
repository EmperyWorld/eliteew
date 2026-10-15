/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Facade hook — starts companion operations runtime and exposes store selectors.
 * Legacy import path preserved; state lives in companionOperationsStore.
 *
 * Invariants:
 * - Poll/SSE/confirm side effects run in useCompanionOperationsRuntime only once per panel tree.
 * - Runtime handlers are read from companionOperationsRuntimeBridge (stable wrapper callbacks).
 *
 * Related:
 * - companionOperationsStore.ts
 * - useCompanionOperationsRuntime.ts
 */

import { useCallback, useEffect } from 'react';
import type { TFunction } from 'i18next';

import {
	clearCompanionOperationsRuntimeHandlers,
	getCompanionOperationsRuntimeHandlers,
} from '@/features/ewa/companionOperations/companionOperationsRuntimeBridge';
import {
	selectCanLoadMoreOperationsHistory,
	selectOperationsDisplayLimit,
	useCompanionOperationsStore,
	useDisplayOperationRuns,
	useHasActiveOperations,
	useTranscriptProgressItems,
	useTranscriptWorkflowSummaries,
} from '@/features/ewa/companionOperations/companionOperationsStore';
import { useCompanionOperationsRuntime } from '@/features/ewa/companionOperations/useCompanionOperationsRuntime';
import type { CompanionChatAction } from '@/services/ewa/ewaCompanionChatApi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type UseCompanionOperationRunsOptions = {
	pollEnabled: boolean;
	isDesktopWindowActive: boolean;
	notifyError: (message: string) => void;
	notifySuccess?: (title: string, message?: string) => void;
	t: TFunction<'marketing'>;
	onDispatchActions: (actions: CompanionChatAction[]) => void;
	onNewActiveRun?: (run: EwaCompanionTaskRun) => void;
};

export function useCompanionOperationRuns(
	options: UseCompanionOperationRunsOptions
) {
	useCompanionOperationsRuntime(options);

	const operationRuns = useDisplayOperationRuns();
	const operationsRefreshing = useCompanionOperationsStore(
		(s) => s.operationsRefreshing
	);
	const operationsLastErrorMessage = useCompanionOperationsStore(
		(s) => s.operationsLastErrorMessage
	);
	const operationsLastErrorKind = useCompanionOperationsStore(
		(s) => s.operationsLastErrorKind
	);
	const confirmBusyRunId = useCompanionOperationsStore(
		(s) => s.confirmBusyRunId
	);
	const cancelBusyRunId = useCompanionOperationsStore((s) => s.cancelBusyRunId);
	const operationsHistoryExpanded = useCompanionOperationsStore(
		(s) => s.operationsHistoryExpanded
	);
	const operationsDisplayLimit = useCompanionOperationsStore(
		selectOperationsDisplayLimit
	);
	const canLoadMoreOperationsHistory = useCompanionOperationsStore(
		selectCanLoadMoreOperationsHistory
	);
	const transcriptProgressItems = useTranscriptProgressItems(options.t);
	const transcriptWorkflowSummaries = useTranscriptWorkflowSummaries();
	const hasActiveOperations = useHasActiveOperations();
	const setOperationRuns = useCompanionOperationsStore(
		(s) => s.setOperationRuns
	);

	const refreshOperationRuns = useCallback(
		(opts?: {
			silent?: boolean;
			fetchLimit?: number;
			includeSteps?: boolean;
		}) =>
			getCompanionOperationsRuntimeHandlers()?.refreshOperationRuns(opts) ??
			Promise.resolve(),
		[]
	);
	const loadMoreOperationsHistory = useCallback(
		() =>
			getCompanionOperationsRuntimeHandlers()?.loadMoreOperationsHistory() ??
			undefined,
		[]
	);
	const patchOperationRun = useCallback(
		(raw: unknown) =>
			getCompanionOperationsRuntimeHandlers()?.patchOperationRun(raw),
		[]
	);
	const handleConfirmOperationRun = useCallback(
		(runId: string, decision: 'confirm' | 'cancel') =>
			getCompanionOperationsRuntimeHandlers()?.handleConfirmOperationRun(
				runId,
				decision
			) ?? Promise.resolve(),
		[]
	);
	const handleCancelOperationRun = useCallback(
		(runId: string) =>
			getCompanionOperationsRuntimeHandlers()?.handleCancelOperationRun(
				runId
			) ?? Promise.resolve(),
		[]
	);
	const syncTaskRunSnapshot = useCallback(
		(taskRun: unknown) =>
			getCompanionOperationsRuntimeHandlers()?.syncTaskRunSnapshot(taskRun),
		[]
	);

	useEffect(() => {
		return () => {
			clearCompanionOperationsRuntimeHandlers();
			useCompanionOperationsStore.getState().reset();
		};
	}, []);

	return {
		operationRuns,
		setOperationRuns,
		operationsRefreshing,
		operationsLastErrorMessage,
		operationsLastErrorKind,
		refreshOperationRuns,
		operationsHistoryExpanded,
		loadMoreOperationsHistory,
		canLoadMoreOperationsHistory,
		operationsDisplayLimit,
		patchOperationRun,
		handleConfirmOperationRun,
		handleCancelOperationRun,
		confirmBusyRunId,
		cancelBusyRunId,
		hasActiveOperations,
		transcriptProgressItems,
		transcriptWorkflowSummaries,
		syncTaskRunSnapshot,
	};
}
