/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for adaptive workflow execution poll intervals.
 *
 * Invariants:
 * - Open workflow execution panels are bounded to avoid N-card polling fan-out.
 *
 * Related:
 * - services/api/ugs/ugsWorkflowExecutionPolling.ts
 */

import { describe, expect, it } from 'vitest';

import type { WorkflowExecutionRecord } from '../../../../components/UGS/workflows/types';
import {
	toggleWorkflowExecutionPanelState,
	ugsWorkflowExecutionsPollIntervalMs,
} from '../ugsWorkflowExecutionPolling';

function exec(
	status: WorkflowExecutionRecord['status']
): WorkflowExecutionRecord {
	return {
		id: 'e1',
		workflow_id: 'wf-1',
		status,
		created_at: '2026-05-28T00:00:00Z',
	};
}

describe('ugsWorkflowExecutionsPollIntervalMs', () => {
	it('returns false when auto refresh is disabled', () => {
		expect(ugsWorkflowExecutionsPollIntervalMs([exec('running')], false)).toBe(
			false
		);
	});

	it('uses 15s when any execution is pending or running', () => {
		expect(ugsWorkflowExecutionsPollIntervalMs([exec('running')], true)).toBe(
			15_000
		);
		expect(ugsWorkflowExecutionsPollIntervalMs([exec('pending')], true)).toBe(
			15_000
		);
	});

	it('uses 30s for terminal-only execution lists', () => {
		expect(ugsWorkflowExecutionsPollIntervalMs([exec('completed')], true)).toBe(
			30_000
		);
		expect(ugsWorkflowExecutionsPollIntervalMs([], true)).toBe(30_000);
	});

	it('caps open execution panels by closing oldest panels', () => {
		const next = toggleWorkflowExecutionPanelState(
			{ a: true, b: true, c: true },
			'd',
			3
		);

		expect(next).toEqual({ a: false, b: true, c: true, d: true });
	});

	it('closes an already open execution panel', () => {
		expect(toggleWorkflowExecutionPanelState({ a: true }, 'a', 3)).toEqual({
			a: false,
		});
	});
});
