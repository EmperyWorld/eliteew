/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for companion chat SSE task_* handlers (Phase 2 merge into operation runs).
 *
 * Invariants:
 * - No React; safe for Vitest without DOM.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionTaskEvents.ts
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { mergeTaskStepIntoOperationRuns } from '@/features/ewa/companionOperations/companionOperationsUi';
import type {
	CompanionChatStreamHandlers,
	CompanionTaskStepPayload,
	EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

export type CompanionTaskRunsUpdater = (
	prev: EwaCompanionTaskRun[]
) => EwaCompanionTaskRun[];

export type CompanionChatStreamTaskHandlerCallbacks = {
	onRunsChange: (updater: CompanionTaskRunsUpdater) => void;
	onRefreshRuns?: (opts?: { silent?: boolean }) => void;
};

/** Build chat-stream handlers that patch durable runs and optionally refetch from API. */
export function createCompanionChatStreamTaskHandlers(
	callbacks: CompanionChatStreamTaskHandlerCallbacks
): Pick<
	CompanionChatStreamHandlers,
	| 'onTaskAccepted'
	| 'onTaskStep'
	| 'onTaskCompleted'
	| 'onTaskFailed'
	| 'onTaskAwaitingConfirmation'
> {
	const { onRunsChange, onRefreshRuns } = callbacks;
	return {
		onTaskAccepted: () => {
			onRefreshRuns?.({ silent: true });
		},
		onTaskStep: (payload: CompanionTaskStepPayload) => {
			onRunsChange((prev) => mergeTaskStepIntoOperationRuns(prev, payload));
		},
		onTaskCompleted: () => {
			onRefreshRuns?.({ silent: true });
		},
		onTaskFailed: () => {
			onRefreshRuns?.({ silent: true });
		},
		onTaskAwaitingConfirmation: () => {
			onRefreshRuns?.({ silent: true });
		},
	};
}
