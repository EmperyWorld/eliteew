/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression checks for Music Player locale compare helpers.
 *
 * Invariants:
 * - Reserved favorites names match RU and EN variants case-insensitively.
 * - Track name compare respects active locale ordering rules.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerLocale.ts
 */

import { describe, expect, it } from 'vitest';

import {
	compareMusicPlayerTrackNames,
	isReservedMusicPlayerPlaylistName,
	normalizeMusicPlayerCompareText,
	playlistNamesEquivalent,
} from './musicPlayerLocale';
import { FAVORITES_PLAYLIST_CANONICAL_NAME } from './musicPlayerTypes';

describe('musicPlayerLocale', () => {
	it('blocks reserved favorites names in ru and en', () => {
		expect(isReservedMusicPlayerPlaylistName('Любимые')).toBe(true);
		expect(
			isReservedMusicPlayerPlaylistName(FAVORITES_PLAYLIST_CANONICAL_NAME)
		).toBe(true);
		expect(isReservedMusicPlayerPlaylistName('Favorites')).toBe(true);
		expect(isReservedMusicPlayerPlaylistName('focus')).toBe(false);
	});

	it('compares playlist names with locale-aware normalization', () => {
		expect(playlistNamesEquivalent('Focus', 'focus', 'en')).toBe(true);
		expect(playlistNamesEquivalent('Focus', 'focus', 'ru')).toBe(true);
		expect(normalizeMusicPlayerCompareText('  Focus  ', 'en')).toBe('focus');
	});

	it('sorts track names with locale-specific collator', () => {
		expect(compareMusicPlayerTrackNames('Alpha', 'Beta', 'en')).toBeLessThan(0);
		expect(compareMusicPlayerTrackNames('Beta', 'Alpha', 'en')).toBeGreaterThan(
			0
		);
	});
});
