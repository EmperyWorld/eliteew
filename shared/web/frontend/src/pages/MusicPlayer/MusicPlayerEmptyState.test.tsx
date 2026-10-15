/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component tests for Music Player empty-state CTAs and filter reset actions.
 *
 * Invariants:
 * - Library-empty and music-folder-empty states expose generator and CM actions.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerEmptyState.tsx
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MusicPlayerEmptyState } from './MusicPlayerEmptyState';
import { renderMusicPlayer } from './musicPlayerTestI18n';

const baseProps = {
	contentPanelClass: 'panel',
	strokeWidth: 1.5,
	showFilterResetActions: false,
	hasSearchQuery: false,
	hasActiveTag: false,
	hasPlaylistSelection: false,
	hasOriginFilter: false,
	onClearSearch: vi.fn(),
	onClearActiveTag: vi.fn(),
	onClearPlaylistSelection: vi.fn(),
	onClearOriginFilter: vi.fn(),
	onShowAllMusic: vi.fn(),
	onOpenMusicGenerator: vi.fn(),
	onOpenContentManager: vi.fn(),
};

describe('MusicPlayerEmptyState', () => {
	it('renders library CTAs and dispatches open handlers', () => {
		renderMusicPlayer(
			<MusicPlayerEmptyState kind="library-empty" {...baseProps} />
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'Сгенерировать музыку' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Загрузить в Content Manager' })
		);

		expect(baseProps.onOpenMusicGenerator).toHaveBeenCalledTimes(1);
		expect(baseProps.onOpenContentManager).toHaveBeenCalledTimes(1);
	});

	it('offers switch-to-all-music action for empty music folder', () => {
		renderMusicPlayer(
			<MusicPlayerEmptyState kind="music-folder-empty" {...baseProps} />
		);

		expect(screen.getAllByText(/Папка «Музыка»/).length).toBeGreaterThan(0);
		expect(screen.getByText(/Сюда попадают/)).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', { name: 'Показать всю музыку' })
		);
		expect(baseProps.onShowAllMusic).toHaveBeenCalledTimes(1);
	});

	it('shows filter reset actions when filtered empty', () => {
		const onClearSearch = vi.fn();
		renderMusicPlayer(
			<MusicPlayerEmptyState
				kind="filtered-empty"
				{...baseProps}
				showFilterResetActions
				hasSearchQuery
				onClearSearch={onClearSearch}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }));
		expect(onClearSearch).toHaveBeenCalledTimes(1);
	});
});
