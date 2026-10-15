/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strict envelope contract lock for MusicForge admin config revisions (P0 reconstruction).
 *
 * Invariants:
 * - Bare JSON array MUST throw; silent [] / dual-accept forbidden.
 *
 * Related:
 * - `pages/Admin/musicForge/musicForgeAdminApi.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	requireMusicForgeAdminRunsEnvelope,
	requireMusicForgeConfigRevisionsEnvelope,
	requireMusicForgePreviewAudioResponse,
} from '../musicForge/musicForgeAdminApi';

describe('requireMusicForgeConfigRevisionsEnvelope', () => {
	it('принимает только envelope { items, total }', () => {
		const response = requireMusicForgeConfigRevisionsEnvelope({
			items: [
				{
					id: 'rev-1',
					version: 'v1-platform',
					status: 'active',
					notes: null,
					activated_at: '2026-07-20T00:00:00Z',
					created_by: null,
					created_at: '2026-07-20T00:00:00Z',
					updated_at: '2026-07-20T00:00:00Z',
				},
			],
			total: 1,
		});
		expect(response.total).toBe(1);
		expect(response.items[0]?.version).toBe('v1-platform');
	});

	it('бросает на bare array (dual-accept запрещён)', () => {
		expect(() =>
			requireMusicForgeConfigRevisionsEnvelope([
				{ id: 'a', version: 'x', status: 'draft' },
			])
		).toThrow('music_forge_admin_config_revisions_envelope_invalid');
	});

	it('бросает на мусор / отсутствие items|total', () => {
		expect(() => requireMusicForgeConfigRevisionsEnvelope(undefined)).toThrow(
			'music_forge_admin_config_revisions_envelope_invalid'
		);
		expect(() => requireMusicForgeConfigRevisionsEnvelope({})).toThrow(
			'music_forge_admin_config_revisions_envelope_invalid'
		);
		expect(() =>
			requireMusicForgeConfigRevisionsEnvelope({ items: [], total: '1' })
		).toThrow('music_forge_admin_config_revisions_envelope_invalid');
	});
});

describe('requireMusicForgeAdminRunsEnvelope', () => {
	it('бросает если items отсутствует', () => {
		expect(() => requireMusicForgeAdminRunsEnvelope({ total: 3 })).toThrow(
			'music_forge_admin_runs_envelope_invalid'
		);
	});

	it('пропускает mode_key на list items (Wave E)', () => {
		const response = requireMusicForgeAdminRunsEnvelope({
			items: [
				{
					id: 'r1',
					user_id: 'u1',
					status: 'failed',
					idea: 'x',
					duration_seconds: 150,
					model_lane: 'turbo_xl',
					mode_key: 'turbo_xl',
					created_at: '2026-07-20T00:00:00Z',
					updated_at: '2026-07-20T00:00:00Z',
				},
			],
			total: 1,
			limit: 50,
			offset: 0,
		});
		expect(response.items[0]?.mode_key).toBe('turbo_xl');
	});
});

describe('requireMusicForgePreviewAudioResponse', () => {
	it('принимает preview с builder и input_data', () => {
		const response = requireMusicForgePreviewAudioResponse({
			revision_id: 'r1',
			revision_version: 'draft-v1',
			revision_status: 'draft',
			lane_key: 'sft_xl',
			ugs_workflow: 'v4',
			resolved_builder: 'v4_sft',
			input_data: { cfg: 9, sampler_name: 'jkass_admin' },
		});
		expect(response.resolved_builder).toBe('v4_sft');
		expect(response.input_data.cfg).toBe(9);
	});

	it('бросает на мусор / отсутствие input_data', () => {
		expect(() => requireMusicForgePreviewAudioResponse(null)).toThrow(
			'music_forge_admin_preview_audio_invalid'
		);
		expect(() =>
			requireMusicForgePreviewAudioResponse({
				lane_key: 'sft_xl',
				ugs_workflow: 'v4',
				resolved_builder: 'v4_sft',
			})
		).toThrow('music_forge_admin_preview_audio_invalid');
	});
});
