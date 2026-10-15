/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave D lock: Mode picker from capabilities.modes and create payload mode_key.
 *
 * Invariants:
 * - Default mode selected; submit includes mode_key.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeApp.tsx
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicForgeApp } from '../MusicForgeApp';
import { renderMusicForge } from '../musicForgeTestI18n';

const { createMusicForgeRun, fetchMusicForgeRun } = vi.hoisted(() => ({
	createMusicForgeRun: vi.fn().mockResolvedValue({
		run_id: '00000000-0000-4000-8000-000000000001',
		status: 'queued',
	}),
	fetchMusicForgeRun: vi.fn().mockResolvedValue({
		id: '00000000-0000-4000-8000-000000000001',
		status: 'queued',
		idea: 'Night drive song',
		language: 'en',
		duration_seconds: 150,
		progress_current: 0,
		progress_total: 9,
		normalized_input: {},
		song_blueprint: {},
		lyrics_payload: {},
		style_capsule: {},
		render_payload: {},
		result_payload: {},
		error_payload: {},
		created_at: '2026-07-20T00:00:00Z',
		updated_at: '2026-07-20T00:00:00Z',
		steps: [],
	}),
}));

vi.mock('@/services/musicForge/musicForgeApi', () => ({
	fetchMusicForgeCapabilities: vi.fn().mockResolvedValue({
		default_language: 'en',
		languages: [
			{ value: 'auto', label_ru: 'Авто' },
			{ value: 'en', label_ru: 'English' },
		],
		duration_seconds_default: 150,
		duration_seconds_min: 60,
		duration_seconds_max: 240,
		mvp_lane: 'SFT',
		frontend_role: 'thin_client',
		default_mode_key: 'sft_xl',
		modes: [
			{
				mode_key: 'sft_xl',
				label_ru: 'SFT XL',
				label_en: 'SFT XL',
				is_default: true,
				lane_key: 'sft_xl',
			},
			{
				mode_key: 'turbo_xl',
				label_ru: 'Turbo XL',
				label_en: 'Turbo XL',
				is_default: false,
				lane_key: 'turbo_xl',
			},
		],
	}),
	createMusicForgeRun,
	fetchMusicForgeRun,
	cancelMusicForgeRun: vi.fn(),
	monitorMusicForgeRun: vi.fn().mockResolvedValue(undefined),
	isMusicForgeRunTerminalStatus: vi.fn(() => false),
	MUSIC_FORGE_POLL_MS: 4000,
}));

vi.mock('@/pages/Desktop/context/MusicLibraryContext', () => ({
	useMusicLibraryContext: () => ({
		favoriteIdsSet: new Set<string>(),
		toggleFavorite: vi.fn(),
		upsertTrack: vi.fn(),
	}),
}));

vi.mock(
	'@/pages/Desktop/components/DesktopAppChrome',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('@/pages/Desktop/components/DesktopAppChrome')
			>();
		return {
			...actual,
			DesktopAppContentWrapper: ({ children }: { children: ReactNode }) => (
				<div>{children}</div>
			),
		};
	}
);

describe('MusicForgeApp mode picker', () => {
	beforeEach(() => {
		createMusicForgeRun.mockClear();
		fetchMusicForgeRun.mockClear();
	});

	it('defaults to default_mode_key and submits mode_key', async () => {
		renderMusicForge(<MusicForgeApp embedded />);
		fireEvent.click(await screen.findByText('Настройки звучания'));
		await screen.findByText('Стиль генерации');
		const modeSelect = document.getElementById(
			'music-forge-mode'
		) as HTMLSelectElement;
		expect(modeSelect).toBeTruthy();
		expect(modeSelect.value).toBe('sft_xl');
		fireEvent.change(modeSelect, { target: { value: 'turbo_xl' } });

		const idea = screen.getByPlaceholderText(/курага|apricots/i);
		fireEvent.change(idea, { target: { value: 'Night drive song' } });
		fireEvent.click(
			screen.getByRole('button', { name: /создать песню|create song/i })
		);

		await waitFor(() => {
			expect(createMusicForgeRun).toHaveBeenCalled();
		});
		const payload = createMusicForgeRun.mock.calls[0]?.[0] as {
			mode_key?: string;
		};
		expect(payload.mode_key).toBe('turbo_xl');
	});
});
