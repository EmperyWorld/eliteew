/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest contract coverage for **`coerceCompanionActions`** — server may emit snake_case or camelCase optional
 * fields; focus/minimize paths must survive JSON round-trips into the SPA; **`doc_editor_set_body`** is accepted only for **DocEditor**.
 *
 * Invariants:
 * - No network — pure coercion.
 * - **`companionTaskRunImpliesContentLibraryMutation`** gates Content Manager library refresh after orchestrated turns.
 *
 * Related:
 * - src/services/ewa/ewaCompanionChatApi.ts
 */
import {
	coerceCompanionActions,
	companionTaskRunImpliesContentLibraryMutation,
} from '@/services/ewa/ewaCompanionChatApi';
import { describe, expect, it } from 'vitest';

describe('coerceCompanionActions', () => {
	it('accepts music_play_track with unified/content id aliases', () => {
		const out = coerceCompanionActions([
			{
				type: 'music_play_track',
				unified_content_id: 'uc-m1',
				track_name: 'Summer',
			},
			{
				type: 'music_play_track',
				unifiedContentId: 'uc-m2',
				trackName: 'Winter',
				thumbnail_url: 'https://example.com/t.jpg',
			},
			{
				type: 'music_play_track',
				content_id: 'uc-m3',
				name: 'Alias id',
			},
		]);
		expect(out.length).toBe(3);
		const a = out[0];
		expect(a.type).toBe('music_play_track');
		if (a.type === 'music_play_track') {
			expect(a.unified_content_id).toBe('uc-m1');
			expect(a.track_name).toBe('Summer');
		}
		const b = out[1];
		expect(b.type).toBe('music_play_track');
		if (b.type === 'music_play_track') {
			expect(b.unified_content_id).toBe('uc-m2');
			expect(b.track_name).toBe('Winter');
			expect(b.thumbnail_url).toBe('https://example.com/t.jpg');
		}
		const c = out[2];
		expect(c.type).toBe('music_play_track');
		if (c.type === 'music_play_track') {
			expect(c.unified_content_id).toBe('uc-m3');
			expect(c.track_name).toBe('Alias id');
		}
	});

	it('accepts focus/minimize/open with optional Doc/CM ids', () => {
		const out = coerceCompanionActions([
			{ type: 'focus_app', app_component: 'EWDeskApp' },
			{ type: 'minimize_app', appComponent: 'MusicPlayer' },
			{
				type: 'open_app',
				app_component: 'DocEditor',
				unified_content_id: 'uc-1',
			},
			{
				type: 'open_app',
				app_component: 'ContentManagerPro',
				contentManagerFocusUnifiedContentId: 'cm-2',
			},
		]);
		expect(out.map((a) => a.type)).toEqual([
			'focus_app',
			'minimize_app',
			'open_app',
			'open_app',
		]);
		const doc = out[2];
		expect(doc.type).toBe('open_app');
		if (doc.type === 'open_app') {
			expect(doc.unified_content_id).toBe('uc-1');
		}
		const cm = out[3];
		expect(cm.type).toBe('open_app');
		if (cm.type === 'open_app') {
			expect(cm.content_manager_focus_unified_content_id).toBe('cm-2');
		}
	});

	it('accepts ContentManager initial filter search_query (snake or camel)', () => {
		const out = coerceCompanionActions([
			{
				type: 'open_app',
				app_component: 'ContentManagerPro',
				content_manager_initial_filter: {
					search_query: ' invoicing ',
				},
			},
			{
				type: 'open_app',
				app_component: 'ContentManagerPro',
				contentManagerInitialFilter: {
					searchQuery: 'quotes',
				},
			},
		]);
		expect(out.length).toBe(2);
		const first = out[0];
		if (first.type === 'open_app') {
			expect(first.content_manager_initial_filter?.search_query).toBe(
				'invoicing'
			);
		}
		const second = out[1];
		if (second.type === 'open_app') {
			expect(second.content_manager_initial_filter?.search_query).toBe(
				'quotes'
			);
		}
	});

	it('normalizes action type casing', () => {
		expect(
			coerceCompanionActions([
				{ type: 'OPEN_APP', app_component: 'NotificationsApp' },
			])
		).toEqual([{ type: 'open_app', app_component: 'NotificationsApp' }]);
	});

	it('parses JSON-encoded action array string', () => {
		const payload = JSON.stringify([
			{ type: 'open_app', app_component: 'ClipboardManager' },
		]);
		expect(coerceCompanionActions(payload)).toEqual([
			{ type: 'open_app', app_component: 'ClipboardManager' },
		]);
	});

	it('accepts ewrp_job_id on open_app for EWRP', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'open_app',
					app_component: 'EWRP',
					ewrp_job_id: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
				},
			])
		).toEqual([
			{
				type: 'open_app',
				app_component: 'EWRP',
				ewrp_job_id: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
			},
		]);
	});

	it('accepts doc_editor_set_body from server payload (DocEditor only)', () => {
		const out = coerceCompanionActions([
			{
				type: 'doc_editor_set_body',
				app_component: 'DocEditor',
				body_html: '<p>a</p>',
				unified_content_id: 'uc-5',
			},
			{
				type: 'doc_editor_set_body',
				app_component: 'EWDeskApp',
				body_html: '<p>x</p>',
			},
		]);
		expect(out).toEqual([
			{
				type: 'doc_editor_set_body',
				app_component: 'DocEditor',
				body_html: '<p>a</p>',
				unified_content_id: 'uc-5',
			},
		]);
	});

	it('accepts companion_action_notice with outcome and rationale', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'companion_action_notice',
					outcome: 'failed',
					rationale: 'Pool unavailable',
				},
			])
		).toEqual([
			{
				type: 'companion_action_notice',
				outcome: 'failed',
				rationale: 'Pool unavailable',
			},
		]);
	});

	it('parses optional outcome on desktop actions', () => {
		expect(
			coerceCompanionActions([
				{
					type: 'open_app',
					app_component: 'MusicForgeApp',
					outcome: 'blocked',
					rationale: 'Not on allowlist',
				},
			])
		).toEqual([
			{
				type: 'open_app',
				app_component: 'MusicForgeApp',
				outcome: 'blocked',
				rationale: 'Not on allowlist',
			},
		]);
	});

	it('drops unknown action types', () => {
		expect(
			coerceCompanionActions([
				{ type: 'explode_desktop', app_component: 'EwaApp' },
			])
		).toEqual([]);
	});
});

describe('companionTaskRunImpliesContentLibraryMutation', () => {
	it('is true for completed task_run with catalog mutation payload', () => {
		expect(
			companionTaskRunImpliesContentLibraryMutation({
				status: 'completed',
				result_payload: { deleted_unified_content_id: 'uuid-1' },
			})
		).toBe(true);
		expect(
			companionTaskRunImpliesContentLibraryMutation({
				status: 'completed',
				result_payload: { renamed_unified_content_id: 'uuid-2' },
			})
		).toBe(true);
		expect(
			companionTaskRunImpliesContentLibraryMutation({
				status: 'completed',
				result_payload: { created_unified_content_id: 'uuid-3' },
			})
		).toBe(true);
	});

	it('is false for pending runs or missing payload', () => {
		expect(
			companionTaskRunImpliesContentLibraryMutation({
				status: 'awaiting_confirmation',
				result_payload: { deleted_unified_content_id: 'x' },
			})
		).toBe(false);
		expect(companionTaskRunImpliesContentLibraryMutation(null)).toBe(false);
		expect(
			companionTaskRunImpliesContentLibraryMutation({ status: 'completed' })
		).toBe(false);
	});
});
