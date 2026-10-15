/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Display-name helpers for Music Player saved playlists (UI layer over persisted names).
 *
 * Invariants:
 * - Persisted favorites playlist keeps canonical stored name; UI resolves localized label by id.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerTypes.ts
 * - src/pages/MusicPlayer/MusicPlayerPlaylistPicker.tsx
 */

import { FAVORITES_PLAYLIST_ID, type SavedPlaylist } from './musicPlayerTypes';

export function resolveMusicPlayerPlaylistDisplayName(
	playlist: SavedPlaylist,
	favoritesDisplayName: string
): string {
	if (playlist.id === FAVORITES_PLAYLIST_ID) {
		return favoritesDisplayName;
	}
	return playlist.name;
}
