/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Adaptive React Query refetch interval for open UGS workflow execution lists.
 *
 * Invariants:
 * - Faster poll (15s) only while pending/running executions exist; otherwise 30s.
 * - Expanded execution-history panels are capped so many open workflow cards do not fan out unbounded polling.
 *
 * Related:
 * - components/UGS/UGSWorkflowsTab.tsx
 */

import type { WorkflowExecutionRecord } from '../../../components/UGS/workflows/types';

export const ACTIVE_WORKFLOW_EXECUTION_STATUSES = [
	'pending',
	'running',
] as const satisfies ReadonlyArray<WorkflowExecutionRecord['status']>;

const ACTIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 30_000;
export const MAX_OPEN_WORKFLOW_EXECUTION_PANELS = 6;

export function ugsWorkflowExecutionsPollIntervalMs(
	executions: WorkflowExecutionRecord[] | undefined,
	autoRefreshEnabled: boolean
): number | false {
	if (!autoRefreshEnabled) {
		return false;
	}
	if (!executions?.length) {
		return IDLE_POLL_MS;
	}
	const hasActive = executions.some((execution) =>
		(ACTIVE_WORKFLOW_EXECUTION_STATUSES as readonly string[]).includes(
			execution.status
		)
	);
	return hasActive ? ACTIVE_POLL_MS : IDLE_POLL_MS;
}

export function toggleWorkflowExecutionPanelState(
	current: Readonly<Record<string, boolean>>,
	workflowId: string,
	maxOpen = MAX_OPEN_WORKFLOW_EXECUTION_PANELS
): Record<string, boolean> {
	const currentlyOpen = Boolean(current[workflowId]);
	if (currentlyOpen) {
		return { ...current, [workflowId]: false };
	}

	const next: Record<string, boolean> = { ...current, [workflowId]: true };
	const openIds = Object.entries(next)
		.filter(([, isOpen]) => isOpen)
		.map(([id]) => id);
	if (openIds.length <= maxOpen) {
		return next;
	}

	for (const id of openIds.slice(0, openIds.length - maxOpen)) {
		next[id] = false;
	}
	return next;
}
