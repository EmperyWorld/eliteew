/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Music library playlist prune decisions after catalog load
 * and favorite toggle normalization.
 *
 * Invariants:
 * - Playlist track-id prune+persist is allowed only when `catalogLoaded` is true.
 * - Upsert-only / partial track sets must return null (no shell write).
 * - Favorite toggle always operates on a favorites-normalized playlist list.
 *
 * Related:
 * - src/pages/Desktop/context/MusicLibraryContext.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import {
	FAVORITES_PLAYLIST_ID,
	normalizePlaylistsWithFavorites,
	type SavedPlaylist,
} from './musicPlayerTypes';

/**
 * When catalog is fully loaded, return playlists with track ids pruned to the
 * available set if any stale ids exist. Otherwise return null (do not persist).
 */
export function computePlaylistPruneForFullCatalog(args: {
	catalogLoaded: boolean;
	playlists: SavedPlaylist[];
	availableTrackIds: ReadonlySet<string>;
}): SavedPlaylist[] | null {
	if (!args.catalogLoaded) return null;
	const hasMissing = args.playlists.some((playlist) =>
		playlist.trackIds.some((trackId) => !args.availableTrackIds.has(trackId))
	);
	if (!hasMissing) return null;
	return args.playlists.map((playlist) => ({
		...playlist,
		trackIds: playlist.trackIds.filter((id) => args.availableTrackIds.has(id)),
	}));
}

/** Toggle a track in «Любимые»; safe when playlists are still empty pre-hydrate. */
export function applyFavoriteToggle(
	playlists: SavedPlaylist[],
	trackId: string
): SavedPlaylist[] {
	const normalizedId = trackId.trim();
	const base = normalizePlaylistsWithFavorites(playlists);
	if (!normalizedId) return base;
	return base.map((playlist) => {
		if (playlist.id !== FAVORITES_PLAYLIST_ID) return playlist;
		const has = playlist.trackIds.includes(normalizedId);
		const trackIds = has
			? playlist.trackIds.filter((id) => id !== normalizedId)
			: [...playlist.trackIds, normalizedId];
		return { ...playlist, trackIds };
	});
}
