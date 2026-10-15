/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: Pipeline Builder lists Mode labels and PATCHes Mode on save (draft).
 *
 * Invariants:
 * - User-facing label_ru visible; saveMode hits patchMusicForgeAdminConfigMode.
 *
 * Related:
 * - src/pages/Admin/musicForge/MusicForgePipelineBuilder.tsx
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMusicForge } from '../../../MusicForge/musicForgeTestI18n';
import { MusicForgePipelineBuilder } from '../MusicForgePipelineBuilder';

const {
	patchMusicForgeAdminConfigMode,
	createMusicForgeAdminConfigMode,
	deleteMusicForgeAdminConfigMode,
	getMusicForgeAdminStageTypes,
} = vi.hoisted(() => ({
	patchMusicForgeAdminConfigMode: vi.fn().mockResolvedValue({}),
	createMusicForgeAdminConfigMode: vi
		.fn()
		.mockResolvedValue({ mode_key: 'custom_sft' }),
	deleteMusicForgeAdminConfigMode: vi.fn().mockResolvedValue({
		deleted: true,
		mode_key: 'turbo_xl',
	}),
	getMusicForgeAdminStageTypes: vi.fn().mockResolvedValue({
		stage_types: ['intent_normalize', 'audio_comfy', 'llm_generate'],
		llm_ugs_type_keys: ['music_generator_forge_lyrics'],
		defaults: {},
	}),
}));

vi.mock('../musicForgeAdminApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../musicForgeAdminApi')>();
	return {
		...actual,
		patchMusicForgeAdminConfigMode,
		createMusicForgeAdminConfigMode,
		deleteMusicForgeAdminConfigMode,
		getMusicForgeAdminStageTypes,
		patchMusicForgeAdminConfigStage: vi.fn(),
		createMusicForgeAdminConfigStage: vi.fn(),
		deleteMusicForgeAdminConfigStage: vi.fn(),
	};
});

describe('MusicForgePipelineBuilder happy path', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shows Mode display label and saves Mode patch when draft', async () => {
		const onChanged = vi.fn().mockResolvedValue(undefined);
		const onError = vi.fn();
		const onMessage = vi.fn();

		renderMusicForge(
			<MusicForgePipelineBuilder
				revisionId="rev-draft"
				isDraft
				modes={{
					sft_xl: {
						mode_key: 'sft_xl',
						label_ru: 'Студия SFT',
						label_en: 'SFT Studio',
						enabled: true,
						is_default: true,
						sort_order: 0,
						lane_key: 'sft_xl',
					},
				}}
				pipelines={{
					sft_xl: [
						{
							stage_key: 'audio_1',
							stage_type: 'audio_comfy',
							title_ru: 'Рендер',
							sort_order: 1,
							enabled: true,
							settings: { lane_key: 'sft_xl' },
						},
					],
				}}
				laneKeys={['sft_xl']}
				onChanged={onChanged}
				onError={onError}
				onMessage={onMessage}
			/>
		);

		await waitFor(() => {
			expect(screen.getByText(/Студия SFT/i)).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: 'Сохранить стиль' }));

		await waitFor(() => {
			expect(patchMusicForgeAdminConfigMode).toHaveBeenCalledWith(
				'rev-draft',
				'sft_xl',
				expect.objectContaining({
					label_ru: 'Студия SFT',
					lane_key: 'sft_xl',
					enabled: true,
					is_default: true,
				})
			);
			expect(onChanged).toHaveBeenCalled();
		});
	});

	it('deletes a Mode when more than one exists', async () => {
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		const onChanged = vi.fn().mockResolvedValue(undefined);

		renderMusicForge(
			<MusicForgePipelineBuilder
				revisionId="rev-draft"
				isDraft
				modes={{
					sft_xl: {
						mode_key: 'sft_xl',
						label_ru: 'SFT',
						label_en: 'SFT',
						enabled: true,
						is_default: true,
						sort_order: 0,
						lane_key: 'sft_xl',
					},
					turbo_xl: {
						mode_key: 'turbo_xl',
						label_ru: 'Turbo',
						label_en: 'Turbo',
						enabled: true,
						is_default: false,
						sort_order: 10,
						lane_key: 'turbo_xl',
					},
				}}
				pipelines={{ sft_xl: [], turbo_xl: [] }}
				laneKeys={['sft_xl', 'turbo_xl']}
				onChanged={onChanged}
				onError={vi.fn()}
				onMessage={vi.fn()}
			/>
		);

		const turboButton = screen
			.getAllByRole('button')
			.find(
				(button) =>
					button.textContent?.includes('Turbo') &&
					button.textContent?.includes('turbo_xl')
			);
		expect(turboButton).toBeTruthy();
		fireEvent.click(turboButton as HTMLButtonElement);
		fireEvent.click(screen.getByRole('button', { name: 'Удалить стиль' }));

		await waitFor(() => {
			expect(deleteMusicForgeAdminConfigMode).toHaveBeenCalledWith(
				'rev-draft',
				'turbo_xl'
			);
			expect(onChanged).toHaveBeenCalled();
		});
	});
});
