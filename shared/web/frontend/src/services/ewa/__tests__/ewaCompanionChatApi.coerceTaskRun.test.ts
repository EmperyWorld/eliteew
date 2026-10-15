/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest contract coverage for **`coerceTaskRun`** / **`coerceTaskRunRevision`** and revision-conflict error detection.
 *
 * Invariants:
 * - No network — pure coercion and axios/APIError shape checks.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 */
import { APIError } from '@/services/api/client';
import {
	coerceTaskRun,
	coerceTaskRunRevision,
	coerceTaskRunListRow,
	isCompanionTaskRunRevisionConflictError,
} from '@/services/ewa/ewaCompanionChatApi';
import { AxiosError, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';

describe('coerceTaskRunRevision', () => {
	it('defaults to 1 when missing or invalid', () => {
		expect(coerceTaskRunRevision(undefined)).toBe(1);
		expect(coerceTaskRunRevision(null)).toBe(1);
		expect(coerceTaskRunRevision('2')).toBe(1);
		expect(coerceTaskRunRevision(0)).toBe(1);
		expect(coerceTaskRunRevision(-3)).toBe(1);
		expect(coerceTaskRunRevision(Number.NaN)).toBe(1);
	});

	it('truncates finite positive numbers', () => {
		expect(coerceTaskRunRevision(2)).toBe(2);
		expect(coerceTaskRunRevision(4.9)).toBe(4);
	});
});

describe('coerceTaskRun run_revision', () => {
	const base = {
		id: 'run-1',
		principal_id: 'p-1',
		status: 'awaiting_confirmation',
		intent_kind: 'theme_set',
		user_message: 'Set theme',
	};

	it('defaults run_revision to 1 when absent on row', () => {
		const out = coerceTaskRun(base);
		expect(out).not.toBeNull();
		expect(out?.run_revision).toBe(1);
	});

	it('preserves server run_revision', () => {
		const out = coerceTaskRun({ ...base, run_revision: 5 });
		expect(out?.run_revision).toBe(5);
	});

	it('preserves unified image tool result payload fields', () => {
		const out = coerceTaskRun({
			...base,
			intent_kind: 'image_edit_background',
			result_payload: {
				image_tool_mode: 'edit',
				content_id: 'img-1',
				source_content_id: 'src-1',
				prompt_preview: 'remove background',
			},
		});
		expect(out?.result_payload).toMatchObject({
			image_tool_mode: 'edit',
			content_id: 'img-1',
			source_content_id: 'src-1',
		});
	});
});

describe('isCompanionTaskRunRevisionConflictError', () => {
	it('returns true for axios 409 with detail code', () => {
		const err = new AxiosError(
			'Conflict',
			'ERR_BAD_REQUEST',
			undefined,
			undefined,
			{
				status: 409,
				data: { detail: 'companion_task_run_revision_conflict' },
			} as AxiosResponse
		);
		expect(isCompanionTaskRunRevisionConflictError(err)).toBe(true);
	});

	it('returns true for APIError 409 with matching code', () => {
		const err = new APIError(
			'Conflict',
			409,
			'companion_task_run_revision_conflict'
		);
		expect(isCompanionTaskRunRevisionConflictError(err)).toBe(true);
	});

	it('returns false for other statuses or codes', () => {
		const err409other = new AxiosError(
			'Conflict',
			'ERR_BAD_REQUEST',
			undefined,
			undefined,
			{
				status: 409,
				data: { detail: 'other_conflict' },
			} as AxiosResponse
		);
		expect(isCompanionTaskRunRevisionConflictError(err409other)).toBe(false);

		const err404 = new AxiosError(
			'Not found',
			'ERR_BAD_REQUEST',
			undefined,
			undefined,
			{
				status: 404,
				data: { detail: 'companion_task_run_revision_conflict' },
			} as AxiosResponse
		);
		expect(isCompanionTaskRunRevisionConflictError(err404)).toBe(false);
	});
});

describe('coerceTaskRunListRow', () => {
	const base = {
		id: 'run-summary',
		principal_id: 'p-1',
		status: 'running',
		intent_kind: 'music_generation_background',
		user_message: 'Song',
	};

	it('summary profile skips surface_blocks coercion', () => {
		const out = coerceTaskRunListRow(
			{
				...base,
				surface_blocks: [{ kind: 'result', body: { huge: true } }],
			},
			'summary'
		);
		expect(out).not.toBeNull();
		expect(out?.id).toBe('run-summary');
		expect(out?.surface_blocks).toBeUndefined();
	});

	it('full profile delegates to coerceTaskRun', () => {
		const out = coerceTaskRunListRow(
			{
				...base,
				run_revision: 3,
			},
			'full'
		);
		expect(out?.id).toBe('run-summary');
		expect(out?.run_revision).toBe(3);
	});
});
