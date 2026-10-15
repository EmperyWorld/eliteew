/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Config editor is read-only for non-draft revisions; draft can PATCH lanes.
 *
 * Invariants:
 * - Active revision shows read-only copy; Save lane control absent.
 * - Draft revision shows Save lane after opening Lanes tab.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgeConfigEditor.tsx
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMusicForge } from '../../../MusicForge/musicForgeTestI18n';
import { MusicForgeConfigEditor } from '../MusicForgeConfigEditor';

const {
	getMusicForgeAdminConfigRevision,
	patchMusicForgeAdminConfigLane,
	getMusicForgeAdminStageTypes,
} = vi.hoisted(() => ({
	getMusicForgeAdminConfigRevision: vi.fn(),
	patchMusicForgeAdminConfigLane: vi.fn().mockResolvedValue({}),
	getMusicForgeAdminStageTypes: vi.fn().mockResolvedValue({
		stage_types: ['intent_normalize', 'audio_comfy'],
		llm_ugs_type_keys: [],
		defaults: {},
	}),
}));

vi.mock('../musicForgeAdminApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../musicForgeAdminApi')>();
	return {
		...actual,
		getMusicForgeAdminConfigRevision,
		patchMusicForgeAdminConfigLane,
		getMusicForgeAdminStageTypes,
		getMusicForgeAdminConfigDiff: vi.fn(),
		previewMusicForgeAdminAudioPayload: vi.fn(),
	};
});

const draftBundle = {
	revision: {
		id: 'rev-draft',
		version: 'draft-1',
		status: 'draft' as const,
		activated_at: null,
		created_at: '2026-07-20T00:00:00Z',
		updated_at: '2026-07-20T00:00:00Z',
		created_by: null,
		notes: null,
	},
	lanes: {
		sft_xl: {
			ugs_workflow: 'v4',
			workflow_file: 'ace_sft_new.json',
			is_default: true,
			sampler: { cfg: 7, steps: 50, sampler_name: 'jkass_quality' },
		},
	},
	styles: { pop: { keyscale: 'C major', bpm_default: 120 } },
	prompts: { blueprint: { system_prompt: 'bp' } },
	product: {
		duration_min: 60,
		duration_max: 240,
		duration_default: 180,
		mvp_lane_label: 'SFT',
		audio_type_key: 'music_generator_forge_audio',
	},
	modes: {
		sft_xl: {
			mode_key: 'sft_xl',
			label_ru: 'SFT XL',
			label_en: 'SFT XL',
			enabled: true,
			is_default: true,
			sort_order: 0,
			lane_key: 'sft_xl',
		},
	},
	pipelines: {
		sft_xl: [
			{
				stage_key: 'audio',
				stage_type: 'audio_comfy',
				title_ru: 'Audio',
				sort_order: 0,
				enabled: true,
				settings: {},
			},
		],
	},
};

describe('MusicForgeConfigEditor draft gate', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows read-only banner for active revision and hides lane save', async () => {
		getMusicForgeAdminConfigRevision.mockResolvedValue({
			...draftBundle,
			revision: {
				...draftBundle.revision,
				id: 'rev-active',
				version: 'v2',
				status: 'active',
			},
		});

		renderMusicForge(
			<MusicForgeConfigEditor revisionId="rev-active" onClose={vi.fn()} />
		);

		await waitFor(() => {
			expect(screen.getByText(/это не черновик/i)).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Лейны рендера' }));
		expect(screen.queryByRole('button', { name: 'Сохранить лейн' })).toBeNull();
	});

	it('allows lane PATCH when revision is draft', async () => {
		getMusicForgeAdminConfigRevision.mockResolvedValue(draftBundle);

		renderMusicForge(
			<MusicForgeConfigEditor revisionId="rev-draft" onClose={vi.fn()} />
		);

		await waitFor(() => {
			expect(screen.getByText(/draft-1/i)).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Лейны рендера' }));
		const save = await screen.findByRole('button', {
			name: 'Сохранить лейн',
		});
		fireEvent.click(save);

		await waitFor(() => {
			expect(patchMusicForgeAdminConfigLane).toHaveBeenCalledWith(
				'rev-draft',
				'sft_xl',
				expect.objectContaining({
					ugs_workflow: 'v4',
					workflow_file: 'ace_sft_new.json',
				})
			);
		});
	});
});
