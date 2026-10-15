/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Songs panel — status filter, list load, drawer inspector open.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMusicForge } from '../../../MusicForge/musicForgeTestI18n';
import { MusicForgeAdminRunsPanel } from '../MusicForgeAdminRunsPanel';

const { getMusicForgeAdminRuns, getMusicForgeAdminRun } = vi.hoisted(() => ({
	getMusicForgeAdminRuns: vi.fn(),
	getMusicForgeAdminRun: vi.fn(),
}));

vi.mock('../musicForgeAdminApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../musicForgeAdminApi')>();
	return {
		...actual,
		getMusicForgeAdminRuns,
		getMusicForgeAdminRun,
	};
});

const sampleRow = {
	id: '00000000-0000-4000-8000-000000000099',
	user_id: '00000000-0000-4000-8000-000000000001',
	status: 'completed' as const,
	idea: 'Night drive on the coast',
	duration_seconds: 180,
	language: 'en',
	style_hint: 'synthwave',
	result_track_name: 'Coast night',
	progress_current: 9,
	progress_total: 9,
	model_lane: 'turbo_xl',
	mode_key: 'turbo_xl',
	created_at: '2026-07-20T12:00:00Z',
	updated_at: '2026-07-20T12:05:00Z',
};

describe('MusicForgeAdminRunsPanel', () => {
	beforeEach(() => {
		getMusicForgeAdminRuns.mockReset();
		getMusicForgeAdminRun.mockReset();
		getMusicForgeAdminRuns.mockResolvedValue({
			items: [sampleRow],
			total: 1,
			limit: 50,
			offset: 0,
		});
		getMusicForgeAdminRun.mockResolvedValue({
			...sampleRow,
			language: 'en',
			style_hint: 'synthwave',
			constraints:
				'Lead vocal: female. Full TOP song; clear sung words; no wordless wailing.',
			progress_current: 9,
			progress_total: 9,
			normalized_input: { mode_key: 'turbo_xl', model_lane: 'turbo_xl' },
			song_blueprint: {},
			lyrics_payload: { lyrics: 'Verse one' },
			style_capsule: {},
			render_payload: {},
			result_payload: { name: 'Coast night', content_id: 'content-1' },
			error_payload: {},
			config_revision_id: '00000000-0000-4000-8000-000000000010',
			config_version: 'draft-v1',
			config_generation: 7,
			steps: [],
		});
	});

	it('loads runs and opens inspector drawer on row click', async () => {
		const user = userEvent.setup();
		renderMusicForge(<MusicForgeAdminRunsPanel />);

		await waitFor(() => {
			expect(getMusicForgeAdminRuns).toHaveBeenCalledWith(
				expect.objectContaining({
					limit: 50,
					offset: 0,
				})
			);
		});

		expect(
			await screen.findByText('Night drive on the coast')
		).toBeInTheDocument();

		await user.click(screen.getByText('Night drive on the coast'));

		await waitFor(() => {
			expect(getMusicForgeAdminRun).toHaveBeenCalledWith(sampleRow.id);
		});

		expect(screen.getAllByText('Coast night').length).toBeGreaterThan(0);
		expect(screen.getByText('О песне')).toBeInTheDocument();
	});

	it('passes mode_key filter to API', async () => {
		const user = userEvent.setup();
		renderMusicForge(<MusicForgeAdminRunsPanel />);

		await screen.findByText('Night drive on the coast');

		const modeInput = screen.getByLabelText(/ключ стиля/i);
		await user.type(modeInput, 'turbo_xl');

		await waitFor(() => {
			expect(getMusicForgeAdminRuns).toHaveBeenLastCalledWith(
				expect.objectContaining({
					mode_key: 'turbo_xl',
				})
			);
		});
	});
});
