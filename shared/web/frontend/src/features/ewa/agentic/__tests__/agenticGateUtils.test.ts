/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';

import { parseAgenticGateFromRun } from '@/features/ewa/agentic/agenticGateUtils';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatCoerce';

describe('parseAgenticGateFromRun', () => {
	it('parses confirmation_state gate for agentic awaiting_confirmation', () => {
		const run = {
			id: 'run-1',
			status: 'awaiting_confirmation',
			confirmation_state: {
				state: 'confirming',
				gate: {
					gate_id: 'g-1',
					kind: 'confirm',
					prompt: 'Proceed with file delete?',
					expect_session_revision: 4,
					bound_node_id: 'node-9',
				},
			},
		} as unknown as EwaCompanionTaskRun;

		const gate = parseAgenticGateFromRun(run);
		expect(gate?.kind).toBe('confirm');
		expect(gate?.prompt).toContain('file delete');
		expect(gate?.expectSessionRevision).toBe(4);
		expect(gate?.boundNodeId).toBe('node-9');
	});

	it('parses companion_pending_task_run_id and pending_tool', () => {
		const run = {
			id: 'run-agentic',
			status: 'awaiting_confirmation',
			confirmation_state: {
				state: 'confirming',
				gate: {
					kind: 'confirm',
					prompt: 'нужен ответ',
					pending_tool: 'file_create',
					companion_pending_task_run_id: 'doc-run-99',
				},
			},
		} as unknown as EwaCompanionTaskRun;

		const gate = parseAgenticGateFromRun(run);
		expect(gate?.pendingTool).toBe('file_create');
		expect(gate?.companionPendingTaskRunId).toBe('doc-run-99');
	});

	it('returns null when not awaiting confirmation', () => {
		const run = {
			id: 'run-2',
			status: 'running',
		} as EwaCompanionTaskRun;
		expect(parseAgenticGateFromRun(run)).toBeNull();
	});
});
