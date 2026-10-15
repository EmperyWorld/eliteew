/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for MusicForge result card edge states and feedback UX.
 *
 * Invariants:
 * - Completed runs render even without download_url; feedback failures are visible.
 * - Like wires forge feedback + Music Player favorites; play uses desktop player event.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeResultCard.tsx
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MusicForgeRun } from '@/services/musicForge/musicForgeApi';
import { MusicForgeResultCard } from '../MusicForgeResultCard';
import { renderMusicForge } from '../musicForgeTestI18n';

const recordMusicForgeFeedback = vi.fn();
const resolveMusicForgeResultAudioStreamUrl = vi.fn();
const fetchMusicForgeResultAudioBlob = vi.fn();
const requestPlayInMusicPlayer = vi.fn();
const requestOpenDesktopApp = vi.fn();
const toggleFavorite = vi.fn();
const upsertTrack = vi.fn();
const favoriteIdsSet = new Set<string>();

vi.mock('@/services/musicForge/musicForgeApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/services/musicForge/musicForgeApi')
		>();
	return {
		...actual,
		recordMusicForgeFeedback: (...args: unknown[]) =>
			recordMusicForgeFeedback(...args),
		resolveMusicForgeResultAudioStreamUrl: (...args: unknown[]) =>
			resolveMusicForgeResultAudioStreamUrl(...args),
		fetchMusicForgeResultAudioBlob: (...args: unknown[]) =>
			fetchMusicForgeResultAudioBlob(...args),
	};
});

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
	requestPlayInMusicPlayer: (...args: unknown[]) =>
		requestPlayInMusicPlayer(...args),
	requestPlayAndOpenMusicPlayer: (...args: unknown[]) => {
		requestPlayInMusicPlayer(...args);
		requestOpenDesktopApp({ appComponent: 'MusicPlayer' });
	},
}));

vi.mock('@/pages/Desktop/context/MusicLibraryContext', () => ({
	useMusicLibraryContext: () => ({
		favoriteIdsSet,
		toggleFavorite,
		upsertTrack,
	}),
}));

function completedRun(overrides: Partial<MusicForgeRun> = {}): MusicForgeRun {
	return {
		id: 'run-complete-1',
		status: 'completed',
		idea: 'test',
		language: 'ru',
		duration_seconds: 120,
		progress_current: 8,
		progress_total: 8,
		normalized_input: {},
		song_blueprint: {},
		lyrics_payload: { lyrics: 'Строка текста' },
		style_capsule: { caption: 'Тёплый поп' },
		render_payload: {},
		result_payload: { name: 'Тестовый трек' },
		error_payload: {},
		created_at: '2026-06-30T00:00:00Z',
		updated_at: '2026-06-30T00:00:00Z',
		steps: [],
		...overrides,
	};
}

describe('MusicForgeResultCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		favoriteIdsSet.clear();
		sessionStorage.clear();
		resolveMusicForgeResultAudioStreamUrl.mockResolvedValue(null);
		fetchMusicForgeResultAudioBlob.mockResolvedValue(null);
	});

	it('renders completed shell without download_url', () => {
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					style_hint: 'pop',
					constraints:
						'Lead vocal: female. Full TOP song; clear sung words; no wordless wailing.',
				})}
			/>
		);
		expect(screen.getByText('Тестовый трек')).toBeInTheDocument();
		expect(
			screen.getByTestId('music-forge-feedback-panel')
		).toBeInTheDocument();
		expect(screen.getByText('Женский')).toBeInTheDocument();
		expect(screen.getByText('Поп')).toBeInTheDocument();
		expect(
			screen.getByText('Трек сохранён, но не удалось открыть здесь.')
		).toBeInTheDocument();
	});

	it('shows feedback error when API rejects', async () => {
		recordMusicForgeFeedback.mockRejectedValueOnce(new Error('fail'));
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					content_id: 'content-1',
					result_payload: {
						name: 'Тестовый трек',
						content_id: 'content-1',
					},
				})}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: /Вокал/i }));
		fireEvent.click(screen.getByRole('button', { name: /Не нравится/i }));
		await waitFor(() => {
			expect(
				screen.getByText('Не удалось сохранить оценку. Попробуйте ещё раз.')
			).toBeInTheDocument();
		});
	});

	it('sets aria-pressed on like after success and adds favorites', async () => {
		recordMusicForgeFeedback.mockResolvedValueOnce({
			ok: true,
			rating: 'like',
		});
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					content_id: 'content-like-1',
					result_payload: {
						name: 'Тестовый трек',
						content_id: 'content-like-1',
					},
				})}
			/>
		);
		const likeButton = screen.getByRole('button', { name: /^Нравится$/i });
		fireEvent.click(likeButton);
		await waitFor(() => {
			expect(likeButton).toHaveAttribute('aria-pressed', 'true');
		});
		expect(toggleFavorite).toHaveBeenCalledWith('content-like-1');
		expect(screen.getByText(/добавлен в «Любимые»/i)).toBeInTheDocument();
	});

	it('auto-plays in desktop player when content_id is present', async () => {
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					id: 'run-auto-play',
					content_id: 'content-play-1',
					result_payload: {
						name: 'Тестовый трек',
						content_id: 'content-play-1',
					},
				})}
			/>
		);
		await waitFor(() => {
			expect(requestPlayInMusicPlayer).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'content-play-1',
					name: 'Тестовый трек',
					source_surface: 'music-generator',
				})
			);
		});
	});

	it('play CTA dispatches desktop player request and opens Music Player', () => {
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					id: 'run-cta-play',
					content_id: 'content-cta-1',
					result_payload: {
						name: 'Тестовый трек',
						content_id: 'content-cta-1',
					},
				})}
			/>
		);
		requestPlayInMusicPlayer.mockClear();
		requestOpenDesktopApp.mockClear();
		fireEvent.click(screen.getByRole('button', { name: /Слушать в плеере/i }));
		expect(requestPlayInMusicPlayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'content-cta-1' })
		);
		expect(requestOpenDesktopApp).toHaveBeenCalledWith({
			appComponent: 'MusicPlayer',
		});
	});

	it('copies lyrics to clipboard from result card', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText },
		});
		renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					lyrics_payload: { lyrics: 'Line one\nLine two' },
				})}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: /^Скопировать$/i }));
		await waitFor(() => {
			expect(writeText).toHaveBeenCalledWith('Line one\nLine two');
		});
		expect(screen.getByText('Скопировано')).toBeInTheDocument();
	});

	it('does not mount a local audio element when content_id is present', () => {
		const { container } = renderMusicForge(
			<MusicForgeResultCard
				run={completedRun({
					id: 'run-no-local-audio',
					content_id: 'content-global-1',
					result_payload: {
						name: 'Тестовый трек',
						content_id: 'content-global-1',
						download_url: '/api/v1/content/content-global-1/download',
					},
				})}
			/>
		);
		expect(container.querySelector('audio')).toBeNull();
		expect(
			screen.getByTestId('music-forge-result-playback-hero')
		).toBeInTheDocument();
		expect(screen.getByText(/Music Player на столе/i)).toBeInTheDocument();
	});
});
