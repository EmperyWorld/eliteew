/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locale helpers for Music Player sort order and playlist name comparison.
 *
 * Invariants:
 * - Reserved favorites names are blocked in both RU and EN normalizations regardless of UI locale.
 * - Compare/sort uses active i18n language mapped through resolveIntlDateLocale.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerPlaylistNaming.ts
 */

import { resolveIntlDateLocale } from '../../components/UnifiedContent/utils/contentUtils';
import { FAVORITES_PLAYLIST_CANONICAL_NAME } from './musicPlayerTypes';

export function normalizeMusicPlayerCompareText(
	value: string,
	locale?: string
): string {
	return value.trim().toLocaleLowerCase(resolveIntlDateLocale(locale));
}

const RESERVED_PLAYLIST_NAMES = new Set([
	normalizeMusicPlayerCompareText(FAVORITES_PLAYLIST_CANONICAL_NAME, 'ru'),
	normalizeMusicPlayerCompareText('Favorites', 'en'),
]);

export function compareMusicPlayerTrackNames(
	left: string,
	right: string,
	locale?: string
): number {
	return left.localeCompare(right, resolveIntlDateLocale(locale), {
		sensitivity: 'base',
	});
}

export function isReservedMusicPlayerPlaylistName(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) return false;
	return (
		RESERVED_PLAYLIST_NAMES.has(
			normalizeMusicPlayerCompareText(trimmed, 'ru')
		) ||
		RESERVED_PLAYLIST_NAMES.has(normalizeMusicPlayerCompareText(trimmed, 'en'))
	);
}

export function playlistNamesEquivalent(
	left: string,
	right: string,
	locale?: string
): boolean {
	return (
		normalizeMusicPlayerCompareText(left, locale) ===
		normalizeMusicPlayerCompareText(right, locale)
	);
}
