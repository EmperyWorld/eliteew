/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest fixtures for companion chat SSE task event JSON parsers (Phase 2).
 *
 * Invariants:
 * - Malformed payloads return null without throwing.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	parseTaskAcceptedPayload,
	parseTaskAwaitingConfirmationPayload,
	parseTaskStepPayload,
	parseTaskTerminalPayload,
	newCompanionClientTurnId,
} from '@/services/ewa/ewaCompanionChatApi';

describe('ewaCompanionChatApi task event parsers', () => {
	it('parses task_accepted payload', () => {
		const payload = parseTaskAcceptedPayload(
			JSON.stringify({
				run_id: 'run-1',
				status: 'running',
				intent_kind: 'music_generation_background',
				execution_mode: 'async',
			})
		);
		expect(payload).toEqual({
			run_id: 'run-1',
			status: 'running',
			intent_kind: 'music_generation_background',
			execution_mode: 'async',
		});
	});

	it('parses task_step payload with progress', () => {
		const payload = parseTaskStepPayload(
			JSON.stringify({
				run_id: 'run-1',
				step_index: 3,
				step_kind: 'generate-style',
				status: 'in_progress',
				title: 'Style generation',
				progress: { current: 3, total: 4 },
			})
		);
		expect(payload?.run_id).toBe('run-1');
		expect(payload?.progress).toEqual({ current: 3, total: 4 });
		expect(payload?.title).toBe('Style generation');
	});

	it('parses task_completed payload', () => {
		const payload = parseTaskTerminalPayload(
			JSON.stringify({
				run_id: 'run-9',
				status: 'completed',
				intent_kind: 'music_generation_background',
				result_payload: { content_id: 'c-1' },
			})
		);
		expect(payload?.run_id).toBe('run-9');
		expect(payload?.result_payload).toEqual({ content_id: 'c-1' });
	});

	it('parses task terminal payload with linked_task_run_id fallback', () => {
		const payload = parseTaskTerminalPayload(
			JSON.stringify({
				linked_task_run_id: 'run-agentic-1',
				status: 'failed',
				intent_kind: 'agentic_session',
				error_payload: { reason: 'Reasoning_Loop_Detected' },
			})
		);
		expect(payload?.run_id).toBe('run-agentic-1');
		expect(payload?.error_payload).toEqual({
			reason: 'Reasoning_Loop_Detected',
		});
	});

	it('parses task_awaiting_confirmation payload', () => {
		const payload = parseTaskAwaitingConfirmationPayload(
			JSON.stringify({
				run_id: 'run-c',
				status: 'awaiting_confirmation',
				intent_kind: 'file_create',
				plan_kind: 'doc_create',
			})
		);
		expect(payload).toEqual({
			run_id: 'run-c',
			status: 'awaiting_confirmation',
			intent_kind: 'file_create',
			plan_kind: 'doc_create',
		});
	});

	it('newCompanionClientTurnId returns non-empty string', () => {
		const id = newCompanionClientTurnId();
		expect(typeof id).toBe('string');
		expect(id.trim().length).toBeGreaterThan(8);
	});

	it('returns null for malformed JSON', () => {
		expect(parseTaskStepPayload('{bad')).toBeNull();
		expect(parseTaskAcceptedPayload('{}')).toBeNull();
	});
});
