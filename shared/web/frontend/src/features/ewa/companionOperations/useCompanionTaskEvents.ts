/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable companion chat SSE task event handlers for merging into operation runs (Phase 2).
 *
 * Invariants:
 * - Handlers delegate to ``createCompanionChatStreamTaskHandlers``; no duplicate merge logic.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionTaskEventHandlers.ts
 * - src/features/ewa/companionOperations/useCompanionOperationRuns.ts
 */

import { useMemo } from 'react';

import {
	type CompanionChatStreamTaskHandlerCallbacks,
	createCompanionChatStreamTaskHandlers,
} from '@/features/ewa/companionOperations/companionTaskEventHandlers';
import type { CompanionChatStreamHandlers } from '@/services/ewa/ewaCompanionChatApi';

export function useCompanionTaskEvents(
	callbacks: CompanionChatStreamTaskHandlerCallbacks
): {
	taskEventHandlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
	>;
} {
	const { onRunsChange, onRefreshRuns } = callbacks;

	const taskEventHandlers = useMemo(
		() =>
			createCompanionChatStreamTaskHandlers({
				onRunsChange,
				onRefreshRuns,
			}),
		[onRunsChange, onRefreshRuns]
	);

	return { taskEventHandlers };
}
