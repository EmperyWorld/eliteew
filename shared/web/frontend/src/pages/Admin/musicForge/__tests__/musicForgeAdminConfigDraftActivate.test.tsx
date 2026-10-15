/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Config hub create-draft and activate call admin API contracts.
 *
 * Invariants:
 * - Create draft opens editor with returned revision id.
 * - Activate calls activate endpoint for draft row.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgeAdminSection.tsx
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMusicForge } from '../../../MusicForge/musicForgeTestI18n';
import { MusicForgeAdminSection } from '../MusicForgeAdminSection';

const {
	getMusicForgeAdminConfigRevisions,
	createMusicForgeAdminConfigDraft,
	activateMusicForgeAdminConfigRevision,
	getMusicForgeAdminConfigRevision,
	getMusicForgeAdminOverviewStats,
	getMusicForgeAdminStageTypes,
} = vi.hoisted(() => ({
	getMusicForgeAdminConfigRevisions: vi.fn(),
	createMusicForgeAdminConfigDraft: vi.fn(),
	activateMusicForgeAdminConfigRevision: vi.fn(),
	getMusicForgeAdminConfigRevision: vi.fn(),
	getMusicForgeAdminOverviewStats: vi.fn().mockResolvedValue({
		window_hours: 24,
		counts_by_status: {},
		fail_by_stage: [],
		feedback_like: 0,
		feedback_dislike: 0,
		in_process_counters: {},
	}),
	getMusicForgeAdminStageTypes: vi.fn().mockResolvedValue({
		stage_types: ['audio_comfy'],
		llm_ugs_type_keys: [],
		defaults: {},
	}),
}));

vi.mock('../musicForgeAdminApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../musicForgeAdminApi')>();
	return {
		...actual,
		getMusicForgeAdminConfigRevisions,
		createMusicForgeAdminConfigDraft,
		activateMusicForgeAdminConfigRevision,
		getMusicForgeAdminConfigRevision,
		getMusicForgeAdminOverviewStats,
		getMusicForgeAdminStageTypes,
		getMusicForgeAdminRuns: vi.fn().mockResolvedValue({
			items: [],
			total: 0,
			limit: 50,
			offset: 0,
		}),
		getMusicForgeAdminFeedbackStats: vi.fn().mockResolvedValue({
			like: 0,
			dislike: 0,
			dislike_reasons: [],
		}),
		getMusicForgeAdminComfyProbe: vi.fn(),
	};
});

vi.mock('../musicForgeAdminUrl', () => ({
	readMusicForgeAdminTabFromUrl: () => 'config' as const,
	syncMusicForgeAdminTabToUrl: vi.fn(),
}));

describe('MusicForge admin config draft/activate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getMusicForgeAdminConfigRevisions.mockResolvedValue({
			items: [
				{
					id: 'rev-draft',
					version: 'draft-9',
					status: 'draft',
					activated_at: null,
					created_at: '2026-07-20T00:00:00Z',
					updated_at: '2026-07-20T00:00:00Z',
					created_by: null,
					notes: null,
				},
			],
			total: 1,
		});
		createMusicForgeAdminConfigDraft.mockResolvedValue({
			id: 'rev-new-draft',
			version: 'draft-10',
			status: 'draft',
			activated_at: null,
			created_at: '2026-07-20T00:00:00Z',
			updated_at: '2026-07-20T00:00:00Z',
			created_by: null,
			notes: null,
		});
		activateMusicForgeAdminConfigRevision.mockResolvedValue({
			id: 'rev-draft',
			version: 'draft-9',
			status: 'active',
			config_generation: 3,
		});
		getMusicForgeAdminConfigRevision.mockResolvedValue({
			revision: {
				id: 'rev-new-draft',
				version: 'draft-10',
				status: 'draft',
				activated_at: null,
				created_at: '2026-07-20T00:00:00Z',
				updated_at: '2026-07-20T00:00:00Z',
				created_by: null,
				notes: null,
			},
			lanes: {},
			styles: {},
			prompts: {},
			product: {},
			modes: {},
			pipelines: {},
		});
	});

	it('creates draft and opens editor', async () => {
		renderMusicForge(<MusicForgeAdminSection urlSyncEnabled={false} />);

		await waitFor(() => {
			expect(screen.getByText('draft-9')).toBeInTheDocument();
		});

		fireEvent.click(
			screen.getByRole('button', { name: /создать draft из active/i })
		);

		await waitFor(() => {
			expect(createMusicForgeAdminConfigDraft).toHaveBeenCalled();
			expect(getMusicForgeAdminConfigRevision).toHaveBeenCalledWith(
				'rev-new-draft'
			);
		});

		await waitFor(() => {
			expect(screen.getByText(/draft-10/i)).toBeInTheDocument();
		});
	});

	it('activates draft revision from list', async () => {
		renderMusicForge(<MusicForgeAdminSection urlSyncEnabled={false} />);

		await waitFor(() => {
			expect(screen.getByText('draft-9')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /^активировать$/i }));

		await waitFor(() => {
			expect(activateMusicForgeAdminConfigRevision).toHaveBeenCalledWith(
				'rev-draft'
			);
		});
	});
});
