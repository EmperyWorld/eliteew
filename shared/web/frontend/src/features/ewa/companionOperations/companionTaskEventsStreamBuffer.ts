/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounce companion task-run SSE state commits so rapid run_snapshot bursts do not
 * trigger a React render cascade (max one flush per interval).
 *
 * Invariants:
 * - Pending updaters compose left-to-right before flush.
 * - flushNow() applies immediately and cancels any scheduled debounce timer.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionTaskEventsStream.ts
 */

import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type OperationRunsUpdater = (
	prev: EwaCompanionTaskRun[]
) => EwaCompanionTaskRun[];

export type CompanionTaskEventsStreamBuffer = {
	schedule: (updater: OperationRunsUpdater) => void;
	flushNow: () => void;
	dispose: () => void;
};

export const COMPANION_TASK_EVENTS_STREAM_DEBOUNCE_MS = 2000;

export function createCompanionTaskEventsStreamBuffer(
	onFlush: (updater: OperationRunsUpdater) => void,
	debounceMs: number = COMPANION_TASK_EVENTS_STREAM_DEBOUNCE_MS
): CompanionTaskEventsStreamBuffer {
	let pending: OperationRunsUpdater | null = null;
	let timerId: ReturnType<typeof setTimeout> | null = null;

	const clearTimer = () => {
		if (timerId !== null) {
			clearTimeout(timerId);
			timerId = null;
		}
	};

	const flushPending = () => {
		clearTimer();
		const updater = pending;
		pending = null;
		if (updater) onFlush(updater);
	};

	return {
		schedule(updater) {
			const previous = pending;
			pending = previous ? (prev) => updater(previous(prev)) : updater;
			if (timerId === null) {
				timerId = setTimeout(flushPending, debounceMs);
			}
		},
		flushNow() {
			flushPending();
		},
		dispose() {
			clearTimer();
			pending = null;
		},
	};
}
