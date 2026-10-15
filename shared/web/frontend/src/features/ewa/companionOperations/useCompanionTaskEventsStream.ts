/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Long-lived SSE subscription to companion task lifecycle events while background
 * operations run — commits into companionOperationsStore via debounced buffer.
 *
 * Invariants:
 * - Opens only when ``enabled``; aborts on disable/unmount.
 * - Reconnects with backoff after transient failures.
 * - Exactly one active run uses scoped ``/task-runs/{id}/events`` (+ ``run_snapshot``).
 *
 * Related:
 * - companionOperationsStore.ts
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { createCompanionTaskEventsStreamBuffer } from '@/features/ewa/companionOperations/companionTaskEventsStreamBuffer';
import {
	ACTIVE_OPERATION_STATUSES,
	applyTaskTerminalToOperationRuns,
	mergeOperationRuns,
	mergeTaskStepIntoOperationRuns,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import { companionTaskEventsStreamMode } from '@/features/ewa/companionOperations/companionTaskEventsStreamMode';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	streamEwaCompanionTaskEvents,
	streamEwaCompanionTaskRunEvents,
	type CompanionTaskStepPayload,
	type CompanionTaskTerminalPayload,
	type EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';
import { useEffect, useRef } from 'react';

export type CompanionTaskEventsStreamHandlers = {
	onTerminal?: () => void;
};

export const COMPANION_TASK_EVENTS_STREAM_SUCCESS_RECONNECT_MS = 5000;

function waitForTaskEventsReconnect(
	delayMs: number,
	signal: AbortSignal
): Promise<void> {
	if (signal.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		let timerId: ReturnType<typeof setTimeout> | null = null;
		const settle = () => {
			if (timerId !== null) clearTimeout(timerId);
			signal.removeEventListener('abort', settle);
			resolve();
		};
		timerId = setTimeout(settle, delayMs);
		signal.addEventListener('abort', settle, { once: true });
	});
}

function isActiveCompanionRunStatus(
	status: string | null | undefined
): boolean {
	return ACTIVE_OPERATION_STATUSES.has((status || '').trim().toLowerCase());
}

export function useCompanionTaskEventsStream(
	enabled: boolean,
	activeRunIdsKey: string,
	handlers: CompanionTaskEventsStreamHandlers = {}
): void {
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!enabled) return;

		let alive = true;
		let attempt = 0;
		const abort = new AbortController();
		const scopedRunIds = activeRunIdsKey ? activeRunIdsKey.split('|') : [];
		const streamMode = companionTaskEventsStreamMode(scopedRunIds);
		const applyRunsUpdater =
			useCompanionOperationsStore.getState().applyRunsUpdater;
		const runsBuffer = createCompanionTaskEventsStreamBuffer((updater) => {
			applyRunsUpdater(updater);
		});

		const scheduleRunsChange = (
			updater: (prev: EwaCompanionTaskRun[]) => EwaCompanionTaskRun[]
		) => {
			runsBuffer.schedule(updater);
		};

		const flushRunsChange = () => {
			runsBuffer.flushNow();
		};

		let perRunTerminalHandled = false;
		const handleTerminalObserved = () => {
			if (streamMode.mode === 'per_run') {
				if (perRunTerminalHandled) return;
				perRunTerminalHandled = true;
			}
			flushRunsChange();
			handlersRef.current.onTerminal?.();
			if (streamMode.mode === 'per_run') {
				alive = false;
				abort.abort();
			}
		};

		const streamHandlers = {
			signal: abort.signal,
			onRunSnapshot: (run: EwaCompanionTaskRun) => {
				scheduleRunsChange((prev) => mergeOperationRuns(prev, [run]));
				if (!isActiveCompanionRunStatus(run.status)) {
					handleTerminalObserved();
				}
			},
			onTaskStep: (payload: CompanionTaskStepPayload) => {
				scheduleRunsChange((prev) =>
					mergeTaskStepIntoOperationRuns(prev, payload)
				);
			},
			onTaskCompleted: (payload: CompanionTaskTerminalPayload) => {
				scheduleRunsChange((prev) =>
					applyTaskTerminalToOperationRuns(prev, payload, 'completed')
				);
				handleTerminalObserved();
			},
			onTaskFailed: (payload: CompanionTaskTerminalPayload) => {
				scheduleRunsChange((prev) =>
					applyTaskTerminalToOperationRuns(prev, payload, 'failed')
				);
				handleTerminalObserved();
			},
		};

		const connect = async () => {
			while (alive) {
				try {
					if (streamMode.mode === 'per_run' && streamMode.runId) {
						await streamEwaCompanionTaskRunEvents(
							streamMode.runId,
							streamHandlers
						);
					} else {
						await streamEwaCompanionTaskEvents(streamHandlers);
					}
					attempt = 0;
					if (!alive || abort.signal.aborted) break;
					await waitForTaskEventsReconnect(
						COMPANION_TASK_EVENTS_STREAM_SUCCESS_RECONNECT_MS,
						abort.signal
					);
				} catch (err) {
					if (!alive || abort.signal.aborted) break;
					ewaCompanionDegradeDebug(
						'companion_operations_task_events_sse',
						'task events SSE reconnect after failure',
						err
					);
					attempt += 1;
					const delayMs = Math.min(30_000, 1_500 * 2 ** Math.min(attempt, 5));
					await new Promise((r) => setTimeout(r, delayMs));
				}
			}
		};

		void connect();
		return () => {
			alive = false;
			runsBuffer.dispose();
			abort.abort();
		};
	}, [enabled, activeRunIdsKey]);
}
