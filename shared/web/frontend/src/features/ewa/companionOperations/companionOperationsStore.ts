/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central Zustand store for companion operation runs — single source of truth for
 * poll/SSE/confirm mutations with selector-based subscriptions.
 *
 * Invariants:
 * - All run merges go through mergeOperationRuns / mergePolledOperationRuns (30 cap).
 * - Store skips notify only when all visual/run-contract fields are unchanged.
 * - Runtime handlers live in companionOperationsRuntimeBridge (not store state).
 *
 * Related:
 * - useCompanionOperationsRuntime.ts
 * - useCompanionTaskEventsStream.ts
 */

import { create } from 'zustand';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
	ACTIVE_OPERATION_STATUSES,
	deriveTranscriptProgressItems,
	deriveTranscriptWorkflowSummaries,
	filterRunsForOperationsDisplay,
	mergeOperationRuns,
	mergePolledOperationRuns,
	OPERATIONS_DISPLAY_LIMIT_DEFAULT,
	OPERATIONS_DISPLAY_LIMIT_EXPANDED,
	OPERATIONS_FETCH_LIMIT_DEFAULT,
	OPERATIONS_FETCH_LIMIT_EXPANDED,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import type { TFunction } from 'i18next';

type TranscriptProgressSnapshot = ReturnType<
	typeof deriveTranscriptProgressItems
>;
type TranscriptWorkflowSummariesSnapshot = ReturnType<
	typeof deriveTranscriptWorkflowSummaries
>;

let transcriptProgressCache: {
	runs: EwaCompanionTaskRun[];
	t: TFunction<'marketing'> | undefined;
	pollKind: CompanionOperationsDegradedKind | null;
	value: TranscriptProgressSnapshot;
} | null = null;
let transcriptWorkflowSummariesCache: {
	runs: EwaCompanionTaskRun[];
	value: TranscriptWorkflowSummariesSnapshot;
} | null = null;

export type OperationRunsUpdater = (
	prev: EwaCompanionTaskRun[]
) => EwaCompanionTaskRun[];

export type CompanionOperationsStoreState = {
	operationRuns: EwaCompanionTaskRun[];
	operationsRefreshing: boolean;
	operationsLastErrorMessage: string | null;
	operationsLastErrorKind: CompanionOperationsDegradedKind | null;
	confirmBusyRunId: string | null;
	cancelBusyRunId: string | null;
	operationsHistoryExpanded: boolean;
};

export type CompanionOperationsDegradedKind =
	| 'auth'
	| 'backend'
	| 'stale'
	| 'no_mission';

type CompanionOperationsStoreActions = {
	applyRunsUpdater: (updater: OperationRunsUpdater) => void;
	mergeIncomingRuns: (incoming: EwaCompanionTaskRun[]) => void;
	mergePolledRuns: (incoming: EwaCompanionTaskRun[]) => void;
	setOperationRuns: (runs: EwaCompanionTaskRun[]) => void;
	setOperationsRefreshing: (value: boolean) => void;
	setOperationsRefreshError: (
		message: string | null,
		kind?: CompanionOperationsDegradedKind | null
	) => void;
	setConfirmBusyRunId: (runId: string | null) => void;
	setCancelBusyRunId: (runId: string | null) => void;
	setOperationsHistoryExpanded: (value: boolean) => void;
	reset: () => void;
};

export type CompanionOperationsRuntimeHandlers = {
	refreshOperationRuns: (opts?: {
		silent?: boolean;
		fetchLimit?: number;
		includeSteps?: boolean;
	}) => Promise<void>;
	handleConfirmOperationRun: (
		runId: string,
		decision: 'confirm' | 'cancel'
	) => Promise<void>;
	handleCancelOperationRun: (runId: string) => Promise<void>;
	loadMoreOperationsHistory: () => void;
	patchOperationRun: (raw: unknown) => void;
	syncTaskRunSnapshot: (taskRun: unknown) => void;
};

export type CompanionOperationsStore = CompanionOperationsStoreState &
	CompanionOperationsStoreActions;

const INITIAL_STATE: CompanionOperationsStoreState = {
	operationRuns: [],
	operationsRefreshing: false,
	operationsLastErrorMessage: null,
	operationsLastErrorKind: null,
	confirmBusyRunId: null,
	cancelBusyRunId: null,
	operationsHistoryExpanded: false,
};

function jsonSnapshot(value: unknown): string {
	return JSON.stringify(value ?? null);
}

function operationRunRowSnapshotEqual(
	a: EwaCompanionTaskRun,
	b: EwaCompanionTaskRun
): boolean {
	if (a.id !== b.id) return false;
	if ((a.status || '') !== (b.status || '')) return false;
	if ((a.run_revision ?? 1) !== (b.run_revision ?? 1)) return false;
	if ((a.updated_at || '') !== (b.updated_at || '')) return false;
	if (jsonSnapshot(a.error_payload) !== jsonSnapshot(b.error_payload))
		return false;
	if (jsonSnapshot(a.plan_payload) !== jsonSnapshot(b.plan_payload))
		return false;
	if (jsonSnapshot(a.confirmation_state) !== jsonSnapshot(b.confirmation_state))
		return false;
	if (jsonSnapshot(a.result_payload) !== jsonSnapshot(b.result_payload))
		return false;
	if (jsonSnapshot(a.steps) !== jsonSnapshot(b.steps)) return false;
	if (jsonSnapshot(a.surface_blocks) !== jsonSnapshot(b.surface_blocks))
		return false;
	if (
		jsonSnapshot(a.music_pipeline_progress) !==
		jsonSnapshot(b.music_pipeline_progress)
	) {
		return false;
	}
	return true;
}

function operationRunsSnapshotEqual(
	prev: EwaCompanionTaskRun[],
	next: EwaCompanionTaskRun[]
): boolean {
	if (prev === next) return true;
	if (prev.length !== next.length) return false;
	for (let i = 0; i < prev.length; i += 1) {
		if (!operationRunRowSnapshotEqual(prev[i], next[i])) return false;
	}
	return true;
}

function commitOperationRuns(
	prev: EwaCompanionTaskRun[],
	next: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] | null {
	return operationRunsSnapshotEqual(prev, next) ? null : next;
}

export const useCompanionOperationsStore = create<CompanionOperationsStore>(
	(set) => ({
		...INITIAL_STATE,
		applyRunsUpdater: (updater) =>
			set((state) => {
				const next = updater(state.operationRuns);
				const committed = commitOperationRuns(state.operationRuns, next);
				return committed ? { operationRuns: committed } : state;
			}),
		mergeIncomingRuns: (incoming) =>
			set((state) => {
				const next = mergeOperationRuns(state.operationRuns, incoming);
				const committed = commitOperationRuns(state.operationRuns, next);
				return committed ? { operationRuns: committed } : state;
			}),
		mergePolledRuns: (incoming) =>
			set((state) => {
				const next = mergePolledOperationRuns(state.operationRuns, incoming);
				const committed = commitOperationRuns(state.operationRuns, next);
				return committed ? { operationRuns: committed } : state;
			}),
		setOperationRuns: (runs) =>
			set((state) => {
				const committed = commitOperationRuns(state.operationRuns, runs);
				return committed ? { operationRuns: committed } : state;
			}),
		setOperationsRefreshing: (value) =>
			set((state) =>
				state.operationsRefreshing === value
					? state
					: { operationsRefreshing: value }
			),
		setOperationsRefreshError: (message, kind = null) =>
			set((state) => {
				const nextMessage = message?.trim() || null;
				if (!nextMessage) {
					return state.operationsLastErrorMessage === null &&
						state.operationsLastErrorKind === null
						? state
						: {
								operationsLastErrorMessage: null,
								operationsLastErrorKind: null,
							};
				}
				if (
					state.operationsLastErrorMessage === nextMessage &&
					state.operationsLastErrorKind === kind
				) {
					return state;
				}
				return {
					operationsLastErrorMessage: nextMessage,
					operationsLastErrorKind: kind,
				};
			}),
		setConfirmBusyRunId: (runId) => set({ confirmBusyRunId: runId }),
		setCancelBusyRunId: (runId) => set({ cancelBusyRunId: runId }),
		setOperationsHistoryExpanded: (value) =>
			set({ operationsHistoryExpanded: value }),
		reset: () => set({ ...INITIAL_STATE }),
	})
);

/** Imperative access for SSE/poll bridges outside React. */
export function getCompanionOperationsStoreState(): CompanionOperationsStoreState {
	return useCompanionOperationsStore.getState();
}

export function selectDisplayOperationRuns(
	state: CompanionOperationsStoreState
): EwaCompanionTaskRun[] {
	return filterRunsForOperationsDisplay(state.operationRuns);
}

export function selectOperationsFetchLimit(
	state: CompanionOperationsStoreState
): number {
	return state.operationsHistoryExpanded
		? OPERATIONS_FETCH_LIMIT_EXPANDED
		: OPERATIONS_FETCH_LIMIT_DEFAULT;
}

export function selectOperationsDisplayLimit(
	state: CompanionOperationsStoreState
): number {
	return state.operationsHistoryExpanded
		? OPERATIONS_DISPLAY_LIMIT_EXPANDED
		: OPERATIONS_DISPLAY_LIMIT_DEFAULT;
}

export function selectHasActiveOperations(
	state: CompanionOperationsStoreState
): boolean {
	return selectDisplayOperationRuns(state).some((run) =>
		ACTIVE_OPERATION_STATUSES.has((run.status || '').trim().toLowerCase())
	);
}

export function selectActiveRunIds(
	state: CompanionOperationsStoreState
): string[] {
	return selectDisplayOperationRuns(state)
		.filter((run) =>
			ACTIVE_OPERATION_STATUSES.has((run.status || '').trim().toLowerCase())
		)
		.map((run) => run.id)
		.filter((id): id is string => Boolean(id?.trim()));
}

export function selectActiveRunIdsKey(
	state: CompanionOperationsStoreState
): string {
	return selectActiveRunIds(state).sort().join('|');
}

export function selectLiveActiveRunIdSet(
	state: CompanionOperationsStoreState
): ReadonlySet<string> {
	return new Set(selectActiveRunIds(state));
}

export function selectTranscriptProgressItems(
	state: CompanionOperationsStoreState,
	t: TFunction<'marketing'>
) {
	if (
		transcriptProgressCache?.runs === state.operationRuns &&
		transcriptProgressCache.t === t &&
		transcriptProgressCache.pollKind === state.operationsLastErrorKind
	) {
		return transcriptProgressCache.value;
	}
	const value = deriveTranscriptProgressItems(state.operationRuns, t, {
		pollDegradedKind: state.operationsLastErrorKind,
	});
	transcriptProgressCache = {
		runs: state.operationRuns,
		t,
		pollKind: state.operationsLastErrorKind,
		value,
	};
	return value;
}

export function selectTranscriptWorkflowSummaries(
	state: CompanionOperationsStoreState
) {
	if (transcriptWorkflowSummariesCache?.runs === state.operationRuns) {
		return transcriptWorkflowSummariesCache.value;
	}
	const value = deriveTranscriptWorkflowSummaries(state.operationRuns);
	transcriptWorkflowSummariesCache = {
		runs: state.operationRuns,
		value,
	};
	return value;
}

export function selectCanLoadMoreOperationsHistory(
	state: CompanionOperationsStoreState
): boolean {
	if (state.operationsHistoryExpanded) return false;
	return (
		selectDisplayOperationRuns(state).length >= OPERATIONS_DISPLAY_LIMIT_DEFAULT
	);
}

export function useDisplayOperationRuns(): EwaCompanionTaskRun[] {
	return useCompanionOperationsStore(useShallow(selectDisplayOperationRuns));
}

export function useOperationsRefreshing(): boolean {
	return useCompanionOperationsStore((s) => s.operationsRefreshing);
}

export function useOperationsBusyIds(): {
	confirmBusyRunId: string | null;
	cancelBusyRunId: string | null;
} {
	return useCompanionOperationsStore(
		useShallow((s) => ({
			confirmBusyRunId: s.confirmBusyRunId,
			cancelBusyRunId: s.cancelBusyRunId,
		}))
	);
}

export function useTranscriptProgressItems(
	t: TFunction<'marketing'>
): ReturnType<typeof deriveTranscriptProgressItems> {
	return useCompanionOperationsStore(
		useShallow((s) => selectTranscriptProgressItems(s, t))
	);
}

export function useTranscriptWorkflowSummaries(): ReturnType<
	typeof deriveTranscriptWorkflowSummaries
> {
	return useCompanionOperationsStore(
		useShallow(selectTranscriptWorkflowSummaries)
	);
}

export function useHasActiveOperations(): boolean {
	return useCompanionOperationsStore(selectHasActiveOperations);
}

export function useActiveRunIds(): string[] {
	return useCompanionOperationsStore(useShallow(selectActiveRunIds));
}

export function useActiveRunIdsKey(): string {
	return useCompanionOperationsStore(selectActiveRunIdsKey);
}

export function useLiveActiveOperationRunIds(): ReadonlySet<string> {
	const key = useActiveRunIdsKey();
	return useMemo(
		() => new Set(key ? key.split('|').filter(Boolean) : []),
		[key]
	);
}
