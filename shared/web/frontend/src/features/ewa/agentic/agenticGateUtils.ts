/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Parse agentic HITL gate metadata from companion task-run mirror rows.
 *
 * Invariants:
 * - Gate lives in confirmation_state.gate when status is awaiting_confirmation.
 *
 * Related:
 * - api/ewa_platform/agentic/adapters/task_run_mirror.py
 */

import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatCoerce';

export type AgenticGateKind = 'confirm' | 'choose' | 'freeform' | string;

export type AgenticGateView = {
	gateId: string;
	kind: AgenticGateKind;
	prompt: string;
	title: string;
	options: string[];
	expectSessionRevision: number | null;
	boundNodeId: string | null;
	companionPendingTaskRunId: string | null;
	pendingTool: string | null;
};

function readRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

export function parseAgenticGateFromRun(
	run: EwaCompanionTaskRun
): AgenticGateView | null {
	const st = (run.status || '').trim().toLowerCase();
	if (st !== 'awaiting_confirmation') return null;

	const confirmation = readRecord(
		(run as Record<string, unknown>).confirmation_state
	);
	const gate = readRecord(confirmation?.gate);
	if (!gate) return null;

	const prompt =
		typeof gate.prompt === 'string'
			? gate.prompt.trim()
			: typeof gate.body === 'string'
				? gate.body.trim()
				: '';
	const title = typeof gate.title === 'string' ? gate.title.trim() : '';
	const pendingTool =
		typeof gate.pending_tool === 'string' ? gate.pending_tool.trim() : '';
	const companionPendingTaskRunId =
		typeof gate.companion_pending_task_run_id === 'string'
			? gate.companion_pending_task_run_id.trim()
			: '';
	if (!prompt && !title && !pendingTool) return null;

	const optionsRaw = gate.options;
	const options = Array.isArray(optionsRaw)
		? optionsRaw.map((o) => String(o)).filter(Boolean)
		: [];

	return {
		gateId: typeof gate.gate_id === 'string' ? gate.gate_id : '',
		kind: typeof gate.kind === 'string' ? gate.kind : 'confirm',
		prompt,
		title,
		options,
		expectSessionRevision:
			typeof gate.expect_session_revision === 'number'
				? gate.expect_session_revision
				: null,
		boundNodeId:
			typeof gate.bound_node_id === 'string' ? gate.bound_node_id : null,
		companionPendingTaskRunId: companionPendingTaskRunId || null,
		pendingTool: pendingTool || null,
	};
}
