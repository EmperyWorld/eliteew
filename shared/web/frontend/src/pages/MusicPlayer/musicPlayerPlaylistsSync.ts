/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared conversion helpers between Music Player playlist state and desktop shell-state wire schema.
 *
 * Invariants:
 * - Favorites playlist always exists after normalization.
 * - Export/import payload stays compatible with `music_playlists` shell-state structure.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/Desktop/context/MusicLibraryContext.tsx
 */

import type { SavedPlaylist } from './musicPlayerTypes';
import {
	FAVORITES_PLAYLIST_ID,
	normalizePlaylistsWithFavorites,
} from './musicPlayerTypes';
import type { DesktopShellStatePatch } from '../Desktop/services/desktopApi';

export type MusicPlaylistsExportEnvelope = {
	schema: 'eliteew.music_playlists.v1';
	exported_at: string;
	music_playlists: Array<{
		id: string;
		name: string;
		track_ids: string[];
	}>;
};

export function shellMusicPlaylistsToSaved(
	raw: unknown
): SavedPlaylist[] | null {
	if (!Array.isArray(raw)) return null;
	const mapped: SavedPlaylist[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const o = item as Record<string, unknown>;
		const id = o.id;
		const name = o.name;
		if (typeof id !== 'string' || !id.trim()) continue;
		const trackIdsRaw = o.track_ids ?? o.trackIds;
		const trackIds: string[] = [];
		if (Array.isArray(trackIdsRaw)) {
			for (const tid of trackIdsRaw) {
				if (typeof tid === 'string' && tid.trim()) {
					trackIds.push(tid.trim());
				}
			}
		}
		mapped.push({
			id: id.trim(),
			name: typeof name === 'string' ? name : '',
			trackIds,
		});
	}
	return normalizePlaylistsWithFavorites(mapped);
}

export function savedPlaylistsToShellPatch(
	playlists: SavedPlaylist[]
): DesktopShellStatePatch {
	const normalized = normalizePlaylistsWithFavorites(playlists);
	return {
		music_playlists: normalized.map((p) => ({
			id: p.id,
			name: p.name,
			track_ids: p.trackIds,
		})),
	};
}

export function buildMusicPlaylistsExportEnvelope(
	playlists: SavedPlaylist[],
	exportedAtIso: string = new Date().toISOString()
): MusicPlaylistsExportEnvelope {
	const normalized = normalizePlaylistsWithFavorites(playlists);
	return {
		schema: 'eliteew.music_playlists.v1',
		exported_at: exportedAtIso,
		music_playlists: normalized.map((playlist) => ({
			id: playlist.id,
			name: playlist.name,
			track_ids: playlist.trackIds,
		})),
	};
}

export function parseMusicPlaylistsImportPayload(
	raw: string
): SavedPlaylist[] | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (Array.isArray(parsed)) {
			return shellMusicPlaylistsToSaved(parsed);
		}
		if (parsed && typeof parsed === 'object') {
			const maybeEnvelope = parsed as Record<string, unknown>;
			return shellMusicPlaylistsToSaved(maybeEnvelope.music_playlists);
		}
		return null;
	} catch {
		return null;
	}
}

/** Stable compare for hydrate / client merge (avoid setState churn → React #185). */
export function savedPlaylistsShellHash(playlists: SavedPlaylist[]): string {
	return JSON.stringify(savedPlaylistsToShellPatch(playlists).music_playlists);
}

/** Server has only default empty «Любимые» — safe to migrate from legacy localStorage. */
export function isTrivialServerPlaylists(playlists: SavedPlaylist[]): boolean {
	const norm = normalizePlaylistsWithFavorites(playlists);
	return (
		norm.length === 1 &&
		norm[0].id === FAVORITES_PLAYLIST_ID &&
		(norm[0].trackIds?.length ?? 0) === 0
	);
}

export function localPlaylistsLookNonTrivial(
	parsed: SavedPlaylist[] | null
): boolean {
	if (!parsed?.length) return false;
	const norm = normalizePlaylistsWithFavorites(parsed);
	if (norm.length > 1) return true;
	return (norm[0]?.trackIds?.length ?? 0) > 0;
}
