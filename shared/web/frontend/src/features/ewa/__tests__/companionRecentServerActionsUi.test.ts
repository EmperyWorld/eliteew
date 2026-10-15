/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for **recent server actions** strip helpers — coercion mirrors
 * ``api/ewa_platform/companion/sidecar/recent_server_actions._coerce_entry``.
 *
 * Invariants:
 * - Pure logic only; no React or network.
 *
 * Related:
 * - src/features/ewa/companionRecentServerActionsUi.ts
 */
import { describe, expect, it } from 'vitest';
import {
	extractRecentServerActionsForDisplay,
	filterRecentServerActionsForDisplay,
	formatCompanionRecentServerActionLine,
	formatCompanionRecentServerActionUserLine,
	RECENT_SERVER_ACTIONS_UI_MAX_AGE_MS,
} from '../companionRecentServerActionsUi';

const labels = {
	musicStudioOpen: 'Music Studio',
	appOpen: 'Open app',
	themeSet: 'Theme',
	docCreate: 'Doc',
	docInsert: 'Insert',
	fileRename: 'Rename',
	fileDelete: 'Delete',
	planCreate: 'Plan saved',
	planTaskComplete: 'Plan step done',
	operationsStatus: 'Status',
	operationCancel: 'Cancel',
	generic: (tool: string) => `Action ${tool}`,
	statusOk: 'done',
	statusNeedsConfirm: 'confirm',
};

describe('companionRecentServerActionsUi', () => {
	it('returns empty array when ring absent', () => {
		expect(extractRecentServerActionsForDisplay({})).toEqual([]);
		expect(extractRecentServerActionsForDisplay(null)).toEqual([]);
	});

	it('parses JSON string learned_preferences', () => {
		const learned = JSON.stringify({
			companion_recent_server_actions: [
				{ tool: 'theme_set', status: 'ok', summary: 'dark theme' },
			],
		});
		const rows = extractRecentServerActionsForDisplay(learned);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.tool).toBe('theme_set');
		expect(rows[0]?.status).toBe('ok');
	});

	it('drops malformed rows and keeps good ones', () => {
		const rows = extractRecentServerActionsForDisplay({
			companion_recent_server_actions: [
				{},
				{ tool: 'app_open', status: 'ok', summary: 'x'.repeat(300) },
				{ branch: 'fallback_tool', status: 'error', summary: 'nope' },
			],
		});
		expect(rows).toHaveLength(2);
		expect(rows[0]?.tool).toBe('app_open');
		expect(rows[0]?.summary.length).toBeLessThanOrEqual(220);
		expect(rows[1]?.tool).toBe('fallback_tool');
	});

	it('accepts branch as tool fallback', () => {
		const rows = extractRecentServerActionsForDisplay({
			companion_recent_server_actions: [
				{ branch: 'only_branch', status: 'OK', summary: 'test' },
			],
		});
		expect(rows[0]?.tool).toBe('only_branch');
		expect(rows[0]?.status).toBe('ok');
	});

	it('formats display line', () => {
		expect(
			formatCompanionRecentServerActionLine({
				tool: 'file_rewrite',
				branch: 'file_rewrite',
				status: 'needs_confirm',
				summary: 'Rewrite draft.md?',
				ts: '',
			})
		).toBe('file_rewrite · needs_confirm · Rewrite draft.md?');
	});

	it('uses em dash placeholder for empty summary', () => {
		expect(
			formatCompanionRecentServerActionLine({
				tool: 'theme_set',
				branch: 'theme_set',
				status: 'ok',
				summary: '',
				ts: '',
			}).endsWith(' · —')
		).toBe(true);
	});

	it('formats user line from summary when present', () => {
		expect(
			formatCompanionRecentServerActionUserLine(
				{
					tool: 'music_studio_open',
					branch: 'music_studio_open',
					status: 'ok',
					summary: 'Открываю Студию записи',
					ts: '',
				},
				labels
			)
		).toBe('Открываю Студию записи');
	});

	it('formats user line without raw tool id when summary empty', () => {
		expect(
			formatCompanionRecentServerActionUserLine(
				{
					tool: 'music_studio_open',
					branch: 'music_studio_open',
					status: 'ok',
					summary: '',
					ts: '',
				},
				labels
			)
		).toBe('Music Studio — done');
	});

	it('formats plan tools without raw tool ids', () => {
		expect(
			formatCompanionRecentServerActionUserLine(
				{
					tool: 'plan_v1',
					branch: 'plan_v1',
					status: 'ok',
					summary: '',
					ts: '',
				},
				labels
			)
		).toBe('Plan saved — done');
	});

	it('filters rows by age and open app components', () => {
		const now = Date.parse('2026-05-20T12:00:00.000Z');
		const rows = filterRecentServerActionsForDisplay(
			[
				{
					tool: 'theme_set',
					branch: 'theme_set',
					status: 'ok',
					summary: 'dark',
					ts: '2026-05-19T10:00:00.000Z',
				},
				{
					tool: 'music_studio_open',
					branch: 'music_studio_open',
					status: 'ok',
					summary: '',
					ts: '2026-05-20T11:00:00.000Z',
				},
			],
			{
				nowMs: now,
				maxAgeMs: RECENT_SERVER_ACTIONS_UI_MAX_AGE_MS,
				openAppComponents: new Set(['MusicPlayer']),
			}
		);
		expect(rows).toHaveLength(0);
	});
});
