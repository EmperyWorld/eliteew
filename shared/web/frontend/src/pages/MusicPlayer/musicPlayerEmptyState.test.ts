/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Music Player empty-state variant resolution and copy helpers.
 *
 * Invariants:
 * - Folder-empty vs library-empty vs favorites branches stay stable for UI wiring.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerEmptyState.ts
 */

import { describe, expect, it } from 'vitest';
import { FAVORITES_PLAYLIST_ID } from './musicPlayerTypes';
import {
	musicPlayerEmptyStateDescriptionKey,
	musicPlayerEmptyStateShowsLibraryCtas,
	musicPlayerEmptyStateTitleKey,
	resolveMusicPlayerEmptyStateKind,
} from './musicPlayerEmptyState';
import ruDesktopUi from '../../i18n/locales/ru/desktopUi.json';

describe('musicPlayerEmptyState', () => {
	it('resolves music-folder-empty when music filter has zero rows', () => {
		expect(
			resolveMusicPlayerEmptyStateKind({
				tracksLength: 0,
				filterMode: 'music',
				currentPlaylistId: null,
				favoritesPlaylistTrackCount: 0,
			})
		).toBe('music-folder-empty');
	});

	it('resolves library-empty for all-music mode with zero rows', () => {
		expect(
			resolveMusicPlayerEmptyStateKind({
				tracksLength: 0,
				filterMode: 'all',
				currentPlaylistId: null,
				favoritesPlaylistTrackCount: 0,
			})
		).toBe('library-empty');
	});

	it('resolves favorites branches when playlist is selected', () => {
		expect(
			resolveMusicPlayerEmptyStateKind({
				tracksLength: 3,
				filterMode: 'all',
				currentPlaylistId: FAVORITES_PLAYLIST_ID,
				favoritesPlaylistTrackCount: 0,
			})
		).toBe('favorites-empty');
		expect(
			resolveMusicPlayerEmptyStateKind({
				tracksLength: 3,
				filterMode: 'all',
				currentPlaylistId: FAVORITES_PLAYLIST_ID,
				favoritesPlaylistTrackCount: 2,
			})
		).toBe('favorites-filtered');
	});

	it('exposes folder guidance i18n keys and library CTAs', () => {
		expect(musicPlayerEmptyStateTitleKey('music-folder-empty')).toBe(
			'musicPlayer.emptyState.musicFolderEmpty.title'
		);
		const description = (
			ruDesktopUi as {
				musicPlayer: {
					emptyState: { musicFolderEmpty: { description: string } };
				};
			}
		).musicPlayer.emptyState.musicFolderEmpty.description;
		expect(description).toContain('Вся музыка');
		expect(musicPlayerEmptyStateDescriptionKey('music-folder-empty')).toBe(
			'musicPlayer.emptyState.musicFolderEmpty.description'
		);
		expect(musicPlayerEmptyStateShowsLibraryCtas('library-empty')).toBe(true);
		expect(musicPlayerEmptyStateShowsLibraryCtas('music-folder-empty')).toBe(
			true
		);
		expect(musicPlayerEmptyStateShowsLibraryCtas('filtered-empty')).toBe(false);
	});
});
