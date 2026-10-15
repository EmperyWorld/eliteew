/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify queue panel renders upcoming tracks and queued-next indicator.
 *
 * Invariants:
 * - First queue item is marked as "Следующий".
 * - Empty queue shows enqueue guidance copy.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerQueuePanel.tsx
 */

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MusicPlayerQueuePanel } from './MusicPlayerQueuePanel';
import { renderMusicPlayer } from './musicPlayerTestI18n';

describe('MusicPlayerQueuePanel', () => {
	it('renders queued-next state for first item', () => {
		renderMusicPlayer(
			<MusicPlayerQueuePanel
				headerStripClass=""
				onReorderQueue={vi.fn()}
				onMoveQueueItemToTop={vi.fn()}
				onAddCurrentListToQueue={vi.fn()}
				canAddCurrentList
				queue={[
					{ id: 'a', name: 'Track A' },
					{ id: 'b', name: 'Track B' },
				]}
			/>
		);
		expect(screen.getByText('Очередь воспроизведения')).toBeInTheDocument();
		expect(screen.getByText('Следующий')).toBeInTheDocument();
		expect(screen.getByText('Вверх')).toBeInTheDocument();
		expect(screen.getByText('#2')).toBeInTheDocument();
	});

	it('renders empty-state guidance', () => {
		renderMusicPlayer(
			<MusicPlayerQueuePanel
				headerStripClass=""
				queue={[]}
				onReorderQueue={vi.fn()}
				onMoveQueueItemToTop={vi.fn()}
				onAddCurrentListToQueue={vi.fn()}
				canAddCurrentList={false}
			/>
		);
		expect(
			screen.getByText(/Очередь пуста\. Добавьте трек через контекстное меню/)
		).toBeInTheDocument();
		expect(
			screen.getByText('Добавить текущий список в очередь')
		).toBeDisabled();
	});
});
