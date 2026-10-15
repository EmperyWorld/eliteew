/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression checks for localized favorites playlist display name helper.
 *
 * Invariants:
 * - Favorites id resolves to injected display label; other playlists keep stored name.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerPlaylistDisplay.ts
 */

import { describe, expect, it } from 'vitest';

import { resolveMusicPlayerPlaylistDisplayName } from './musicPlayerPlaylistDisplay';
import {
	FAVORITES_PLAYLIST_CANONICAL_NAME,
	FAVORITES_PLAYLIST_ID,
} from './musicPlayerTypes';

describe('resolveMusicPlayerPlaylistDisplayName', () => {
	it('returns localized label for favorites playlist id', () => {
		expect(
			resolveMusicPlayerPlaylistDisplayName(
				{
					id: FAVORITES_PLAYLIST_ID,
					name: FAVORITES_PLAYLIST_CANONICAL_NAME,
					trackIds: [],
				},
				'Favorites'
			)
		).toBe('Favorites');
	});

	it('returns stored name for user playlists', () => {
		expect(
			resolveMusicPlayerPlaylistDisplayName(
				{
					id: 'user-playlist',
					name: 'Focus Session',
					trackIds: ['a'],
				},
				'Favorites'
			)
		).toBe('Focus Session');
	});
});
