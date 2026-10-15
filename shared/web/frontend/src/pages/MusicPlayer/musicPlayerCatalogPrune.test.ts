/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression locks for Music library playlist prune gating and playlist hydration.
 *
 * Invariants:
 * - Upsert-only / catalogLoaded=false must not produce a prune payload to persist.
 * - Playlist filter ordering uses hydrated ids beyond the first catalog page.
 *
 * Related:
 * - musicPlayerCatalogPrune.ts
 * - musicPlayerPlaylistHydration.ts
 */

import { describe, expect, it } from 'vitest';

import {
	applyFavoriteToggle,
	computePlaylistPruneForFullCatalog,
} from './musicPlayerCatalogPrune';
import {
	chunkIds,
	mergeHydratedPlaylistTracks,
	missingPlaylistTrackIds,
	MUSIC_PLAYER_CONTENT_BATCH_MAX_IDS,
	orderTracksByPlaylistIds,
} from './musicPlayerPlaylistHydration';
import { FAVORITES_PLAYLIST_ID, type SavedPlaylist } from './musicPlayerTypes';
import type { Content } from '../../components/UnifiedContent/types';

function stubContent(id: string, name = id): Content {
	return {
		id,
		name,
		content_type: 'audio',
		mime_type: 'audio/mpeg',
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
	} as Content;
}

describe('computePlaylistPruneForFullCatalog', () => {
	const playlists: SavedPlaylist[] = [
		{
			id: FAVORITES_PLAYLIST_ID,
			name: 'Любимые',
			trackIds: ['keep-1', 'gone-2', 'keep-3'],
		},
	];

	it('returns null when catalog is not fully loaded (upsert-only ready)', () => {
		const pruned = computePlaylistPruneForFullCatalog({
			catalogLoaded: false,
			playlists,
			availableTrackIds: new Set(['keep-1']),
		});
		expect(pruned).toBeNull();
	});

	it('returns null when catalog loaded and every playlist id is present', () => {
		const pruned = computePlaylistPruneForFullCatalog({
			catalogLoaded: true,
			playlists,
			availableTrackIds: new Set(['keep-1', 'gone-2', 'keep-3']),
		});
		expect(pruned).toBeNull();
	});

	it('prunes missing ids only after full catalog load', () => {
		const pruned = computePlaylistPruneForFullCatalog({
			catalogLoaded: true,
			playlists,
			availableTrackIds: new Set(['keep-1', 'keep-3']),
		});
		expect(pruned).toEqual([
			{
				id: FAVORITES_PLAYLIST_ID,
				name: 'Любимые',
				trackIds: ['keep-1', 'keep-3'],
			},
		]);
	});
});

describe('applyFavoriteToggle', () => {
	it('adds to Любимые even when playlists state is still empty', () => {
		const next = applyFavoriteToggle([], 'track-new');
		const fav = next.find((p) => p.id === FAVORITES_PLAYLIST_ID);
		expect(fav?.trackIds).toEqual(['track-new']);
	});

	it('toggles an existing favorite off', () => {
		const next = applyFavoriteToggle(
			[
				{
					id: FAVORITES_PLAYLIST_ID,
					name: 'Любимые',
					trackIds: ['track-a', 'track-b'],
				},
			],
			'track-a'
		);
		expect(next.find((p) => p.id === FAVORITES_PLAYLIST_ID)?.trackIds).toEqual([
			'track-b',
		]);
	});
});

describe('musicPlayerPlaylistHydration', () => {
	it('lists missing playlist ids not on the current page', () => {
		expect(
			missingPlaylistTrackIds(['a', 'b', 'c', 'a'], new Set(['a']))
		).toEqual(['b', 'c']);
	});

	it('chunks batch ids at the Unified Content limit', () => {
		const ids = Array.from({ length: 105 }, (_, i) => `id-${i}`);
		const chunks = chunkIds(ids);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toHaveLength(MUSIC_PLAYER_CONTENT_BATCH_MAX_IDS);
		expect(chunks[1]).toHaveLength(5);
	});

	it('merges hydrated rows so playlist filter can include beyond page 1', () => {
		const page = [stubContent('page-1', 'A'), stubContent('page-2', 'B')];
		const hydrated = [stubContent('fav-99', 'Liked beyond page')];
		const merged = mergeHydratedPlaylistTracks(page, hydrated);
		const byId = new Map(merged.map((row) => [row.id, row]));
		const ordered = orderTracksByPlaylistIds(
			['fav-99', 'page-1', 'missing'],
			byId
		);
		expect(ordered.map((row) => row.id)).toEqual(['fav-99', 'page-1']);
		expect(ordered[0]?.name).toBe('Liked beyond page');
	});
});
