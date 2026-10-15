/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave E lock: Run Inspector loads admin run detail and shows mode + config provenance.
 *
 * Invariants:
 * - Calls getMusicForgeAdminRun(runId); surfaces mode_key and config_version.
 *
 * Related:
 * - pages/Admin/musicForge/MusicForgeRunInspector.tsx
 */

import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMusicForge } from '../../MusicForge/musicForgeTestI18n';
import { MusicForgeRunInspector } from '../musicForge/MusicForgeRunInspector';

const { getMusicForgeAdminRun } = vi.hoisted(() => ({
	getMusicForgeAdminRun: vi.fn(),
}));

vi.mock('../musicForge/musicForgeAdminApi', () => ({
	getMusicForgeAdminRun,
}));

describe('MusicForgeRunInspector', () => {
	beforeEach(() => {
		getMusicForgeAdminRun.mockReset();
		getMusicForgeAdminRun.mockResolvedValue({
			id: '00000000-0000-4000-8000-000000000099',
			user_id: '00000000-0000-4000-8000-000000000001',
			status: 'failed',
			idea: 'Night drive',
			language: 'en',
			style_hint: 'synthwave',
			constraints:
				'Lead vocal: female. Full TOP song; clear sung words; no wordless wailing.',
			duration_seconds: 180,
			progress_current: 4,
			progress_total: 9,
			normalized_input: { mode_key: 'turbo_xl', model_lane: 'turbo_xl' },
			song_blueprint: {},
			lyrics_payload: { lyrics: 'Lyrics line' },
			style_capsule: {},
			render_payload: {},
			result_payload: {},
			error_payload: { message: 'render failed', stage: 'audio_render' },
			config_revision_id: '00000000-0000-4000-8000-000000000010',
			config_version: 'draft-v1',
			config_generation: 7,
			created_at: '2026-07-20T00:00:00Z',
			updated_at: '2026-07-20T00:00:00Z',
			steps: [
				{
					step_index: 1,
					step_kind: 'intent_normalize',
					title: 'normalize',
					status: 'completed',
					input_payload: {},
					output_payload: {},
					error_payload: {},
				},
			],
		});
	});

	it('loads detail and shows mode, config version, steps, run error', async () => {
		const onClose = vi.fn();
		renderMusicForge(
			<MusicForgeRunInspector
				runId="00000000-0000-4000-8000-000000000099"
				onClose={onClose}
			/>
		);

		await waitFor(() => {
			expect(getMusicForgeAdminRun).toHaveBeenCalledWith(
				'00000000-0000-4000-8000-000000000099'
			);
		});

		expect(await screen.findByText(/draft-v1/)).toBeInTheDocument();
		expect(screen.getAllByText('turbo_xl').length).toBeGreaterThanOrEqual(2);
		expect(
			screen.getAllByText((_, el) => el?.textContent === '4/9').length
		).toBeGreaterThan(0);
		expect(screen.getByRole('alert')).toHaveTextContent('render failed');
		expect(screen.getByText(/intent_normalize/)).toBeInTheDocument();
		expect(screen.getByText('Lyrics line')).toBeInTheDocument();
		expect(screen.getByText('О песне')).toBeInTheDocument();
	});
});
