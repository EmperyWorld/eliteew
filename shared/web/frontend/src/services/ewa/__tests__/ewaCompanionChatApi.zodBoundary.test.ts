/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Zod runtime validation at companion chat task-run API boundaries
 * (list envelope and confirm response) before **`coerceTaskRun`** normalization.
 *
 * Invariants:
 * - No network — pure parse helpers only.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 * - src/generated/ewa-companion-chat-openapi.ts
 */
import {
	parseCompanionTaskRunConfirmResponse,
	parseCompanionTaskRunsListResponse,
} from '@/services/ewa/ewaCompanionChatApi';
import { describe, expect, it } from 'vitest';

describe('parseCompanionTaskRunsListResponse', () => {
	it('accepts a runs array envelope', () => {
		const rows = [{ id: 'run-1' }, { id: 'run-2' }];
		expect(parseCompanionTaskRunsListResponse({ runs: rows })).toEqual(rows);
	});

	it('accepts an empty runs array', () => {
		expect(parseCompanionTaskRunsListResponse({ runs: [] })).toEqual([]);
	});

	it('throws when runs is missing or not an array', () => {
		expect(() => parseCompanionTaskRunsListResponse({})).toThrow(
			'companion_task_runs_list_invalid_response'
		);
		expect(() => parseCompanionTaskRunsListResponse({ runs: 'nope' })).toThrow(
			'companion_task_runs_list_invalid_response'
		);
		expect(() => parseCompanionTaskRunsListResponse(null)).toThrow(
			'companion_task_runs_list_invalid_response'
		);
	});
});

describe('parseCompanionTaskRunConfirmResponse', () => {
	const taskRun = {
		id: 'run-confirm-1',
		principal_id: 'p-1',
		status: 'awaiting_confirmation',
		intent_kind: 'theme_set',
		user_message: 'Set theme',
	};

	it('accepts confirm payload with task_run row', () => {
		const parsed = parseCompanionTaskRunConfirmResponse({
			ok: true,
			reply: 'Done',
			actions: [],
			task_run: taskRun,
		});
		expect(parsed.ok).toBe(true);
		expect(parsed.reply).toBe('Done');
		expect(parsed.task_run).toMatchObject({ id: 'run-confirm-1' });
	});

	it('throws when task_run is missing or lacks id', () => {
		expect(() =>
			parseCompanionTaskRunConfirmResponse({ ok: true, reply: '' })
		).toThrow('companion_task_run_confirm_invalid_response');
		expect(() =>
			parseCompanionTaskRunConfirmResponse({
				ok: true,
				reply: '',
				task_run: { status: 'running' },
			})
		).toThrow('companion_task_run_confirm_invalid_response');
	});
});
