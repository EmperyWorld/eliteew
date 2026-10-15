/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers to hydrate Music Player playlist rows beyond the paginated catalog page
 * via content batch lookup (favorites / saved playlists).
 *
 * Invariants:
 * - Batch chunks stay ≤100 ids (Unified Content batch API limit).
 * - Merge is idempotent by content id; existing page rows win order, then hydrated.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - GET /api/v1/content/batch
 */

import type { Content } from '../../components/UnifiedContent/types';

/** Unified Content `GET /content/batch` max ids per request. */
export const MUSIC_PLAYER_CONTENT_BATCH_MAX_IDS = 100;

export function missingPlaylistTrackIds(
	playlistTrackIds: readonly string[],
	loadedTrackIds: ReadonlySet<string>
): string[] {
	const missing: string[] = [];
	const seen = new Set<string>();
	for (const raw of playlistTrackIds) {
		const id = raw.trim();
		if (!id || loadedTrackIds.has(id) || seen.has(id)) continue;
		seen.add(id);
		missing.push(id);
	}
	return missing;
}

export function chunkIds(
	ids: readonly string[],
	chunkSize: number = MUSIC_PLAYER_CONTENT_BATCH_MAX_IDS
): string[][] {
	const size = Math.max(1, Math.floor(chunkSize));
	const out: string[][] = [];
	for (let i = 0; i < ids.length; i += size) {
		out.push(ids.slice(i, i + size));
	}
	return out;
}

export function mergeHydratedPlaylistTracks(
	existing: readonly Content[],
	hydrated: readonly Content[]
): Content[] {
	if (hydrated.length === 0) return [...existing];
	const byId = new Map<string, Content>();
	for (const row of existing) {
		byId.set(row.id, row);
	}
	for (const row of hydrated) {
		if (!byId.has(row.id)) {
			byId.set(row.id, row);
		}
	}
	return Array.from(byId.values());
}

/** Keep playlist order when building the visible favorites/playlist list. */
export function orderTracksByPlaylistIds(
	playlistTrackIds: readonly string[],
	tracksById: ReadonlyMap<string, Content>
): Content[] {
	const out: Content[] = [];
	const seen = new Set<string>();
	for (const raw of playlistTrackIds) {
		const id = raw.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const track = tracksById.get(id);
		if (track) out.push(track);
	}
	return out;
}
