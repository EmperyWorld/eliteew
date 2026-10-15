/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused test for MusicForge intake idea min-length helper visibility.
 *
 * Invariants:
 * - User sees hint when idea is non-empty but shorter than 3 chars.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeApp.tsx
 */

import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MusicForgeApp } from '../MusicForgeApp';
import { renderMusicForge } from '../musicForgeTestI18n';

vi.mock('@/services/musicForge/musicForgeApi', () => ({
	fetchMusicForgeCapabilities: vi.fn().mockResolvedValue({
		default_language: 'auto',
		languages: [{ value: 'auto', label_ru: 'Авто' }],
		duration_seconds_default: 220,
		duration_seconds_min: 60,
		duration_seconds_max: 240,
		mvp_lane: 'ace15_sft_single_lane',
		frontend_role: 'thin_client',
	}),
	createMusicForgeRun: vi.fn(),
	fetchMusicForgeRun: vi.fn(),
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

describe('MusicForgeApp idea hint', () => {
	it('uses compact embedded header without subtitle', async () => {
		renderMusicForge(<MusicForgeApp embedded />);
		const header = await screen.findByTestId('music-forge-header');
		expect(header).toHaveAttribute('data-embedded', 'true');
		expect(
			within(header).queryByText(/мы соберём текст, стиль и готовый трек/i)
		).not.toBeInTheDocument();
		expect(header.querySelector('h1')).toHaveClass('text-lg');
	});

	it('shows min-length helper for short non-empty idea', async () => {
		renderMusicForge(<MusicForgeApp embedded />);
		const input = await screen.findByPlaceholderText(/курага/i);
		fireEvent.change(input, { target: { value: 'ab' } });
		expect(
			screen.getByText('Нужно хотя бы 3 символа, чтобы описать идею.')
		).toBeInTheDocument();
	});
});
