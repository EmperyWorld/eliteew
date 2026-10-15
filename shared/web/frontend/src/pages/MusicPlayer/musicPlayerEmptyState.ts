/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve Music Player empty-list variants; i18n keys for titles/descriptions live in `desktopUi.musicPlayer.emptyState`.
 *
 * Invariants:
 * - Variant resolution is pure and mirrors Music Player filter/playlist semantics.
 * - Folder vs all-music guidance stays aligned with Content Manager system folders.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerEmptyState.tsx
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { FAVORITES_PLAYLIST_ID, type FilterMode } from './musicPlayerTypes';

export type MusicPlayerEmptyStateKind =
	| 'library-empty'
	| 'music-folder-empty'
	| 'filtered-empty'
	| 'favorites-empty'
	| 'favorites-filtered';

export function resolveMusicPlayerEmptyStateKind(input: {
	tracksLength: number;
	filterMode: FilterMode;
	currentPlaylistId: string | null;
	favoritesPlaylistTrackCount: number;
}): MusicPlayerEmptyStateKind {
	if (input.tracksLength === 0) {
		return input.filterMode === 'music'
			? 'music-folder-empty'
			: 'library-empty';
	}
	if (input.currentPlaylistId === FAVORITES_PLAYLIST_ID) {
		return input.favoritesPlaylistTrackCount === 0
			? 'favorites-empty'
			: 'favorites-filtered';
	}
	return 'filtered-empty';
}

const EMPTY_STATE_I18N_ROOT: Record<MusicPlayerEmptyStateKind, string> = {
	'music-folder-empty': 'musicFolderEmpty',
	'library-empty': 'libraryEmpty',
	'favorites-empty': 'favoritesEmpty',
	'favorites-filtered': 'favoritesFiltered',
	'filtered-empty': 'filteredEmpty',
};

export function musicPlayerEmptyStateTitleKey(
	kind: MusicPlayerEmptyStateKind
): string {
	return `musicPlayer.emptyState.${EMPTY_STATE_I18N_ROOT[kind]}.title`;
}

export function musicPlayerEmptyStateDescriptionKey(
	kind: MusicPlayerEmptyStateKind
): string {
	return `musicPlayer.emptyState.${EMPTY_STATE_I18N_ROOT[kind]}.description`;
}

export function musicPlayerEmptyStateShowsLibraryCtas(
	kind: MusicPlayerEmptyStateKind
): boolean {
	return kind === 'library-empty' || kind === 'music-folder-empty';
}

export { FAVORITES_PLAYLIST_ID };
