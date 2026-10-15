/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify shared now-playing stall hint visibility, copy, and retry action.
 *
 * Invariants:
 * - Stall hint is suppressed when a hard playback error is present.
 *
 * Related:
 * - src/components/Audio/NowPlayingLoadHint.tsx
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NowPlayingLoadHint } from '@/components/Audio/NowPlayingLoadHint';
import { renderMusicPlayer } from '@/pages/MusicPlayer/musicPlayerTestI18n';

describe('NowPlayingLoadHint', () => {
	it('shows stall copy and retry when loading is stalled', () => {
		const onRetry = vi.fn();
		renderMusicPlayer(
			<NowPlayingLoadHint isLoadingStalled onRetry={onRetry} />
		);
		expect(
			screen.getByText('Загрузка занимает больше обычного')
		).toBeInTheDocument();
		expect(
			screen.getByText('Можно подождать или повторить попытку')
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('hides when a hard error is set', () => {
		renderMusicPlayer(
			<NowPlayingLoadHint
				isLoadingStalled
				error="Ошибка воспроизведения"
				onRetry={vi.fn()}
			/>
		);
		expect(
			screen.queryByText('Загрузка занимает больше обычного')
		).not.toBeInTheDocument();
	});

	it('compact mode omits secondary hint line', () => {
		renderMusicPlayer(
			<NowPlayingLoadHint compact isLoadingStalled onRetry={vi.fn()} />
		);
		expect(
			screen.getByText('Загрузка занимает больше обычного')
		).toBeInTheDocument();
		expect(
			screen.queryByText('Можно подождать или повторить попытку')
		).not.toBeInTheDocument();
	});
});
