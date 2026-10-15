/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Validate aria-live announcements for playback transition states.
 *
 * Invariants:
 * - Announces loading, playing/paused transitions and playback errors.
 *
 * Related:
 * - src/components/Audio/PlaybackStatusAnnouncer.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlaybackStatusAnnouncer } from '@/components/Audio/PlaybackStatusAnnouncer';

describe('PlaybackStatusAnnouncer', () => {
	it('announces loading, playback transitions and error state', () => {
		const { rerender } = render(
			<PlaybackStatusAnnouncer
				playing={false}
				isLoading={false}
				error={null}
				trackName="Track A"
			/>
		);
		const liveRegion = document.querySelector('[aria-live="polite"]');
		expect(liveRegion).toBeTruthy();
		expect(liveRegion?.textContent ?? '').toBe('');
		rerender(
			<PlaybackStatusAnnouncer
				playing={false}
				isLoading
				error={null}
				trackName="Track A"
			/>
		);
		expect(screen.getByText('Загрузка аудио: Track A')).toBeInTheDocument();
		rerender(
			<PlaybackStatusAnnouncer
				playing
				isLoading={false}
				error={null}
				trackName="Track A"
			/>
		);
		expect(screen.getByText('Воспроизведение: Track A')).toBeInTheDocument();
		rerender(
			<PlaybackStatusAnnouncer
				playing={false}
				isLoading={false}
				error={null}
				trackName="Track A"
			/>
		);
		expect(screen.getByText('Пауза')).toBeInTheDocument();
		rerender(
			<PlaybackStatusAnnouncer
				playing={false}
				isLoading={false}
				error="Файл недоступен"
				trackName="Track A"
			/>
		);
		expect(
			screen.getByText('Ошибка воспроизведения: Файл недоступен')
		).toBeInTheDocument();
	});
});
