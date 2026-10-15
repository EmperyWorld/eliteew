/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Naming helpers for playlist create/duplicate flows in Music Player UI.
 *
 * Invariants:
 * - Duplicate naming keeps original base title and appends a deterministic localized suffix.
 * - Returned duplicate names do not conflict with existing normalized playlist names.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { normalizeMusicPlayerCompareText } from './musicPlayerLocale';

export type DuplicatePlaylistNameLabels = {
	fallbackBase: string;
	formatPrimary: (base: string) => string;
	formatIndexed: (base: string, index: number) => string;
};

export function nextDuplicatePlaylistName(
	baseName: string,
	existingNamesLower: Set<string>,
	labels: DuplicatePlaylistNameLabels,
	locale?: string
): string {
	const normalizedBase = baseName.trim() || labels.fallbackBase;
	const primary = labels.formatPrimary(normalizedBase);
	if (
		!existingNamesLower.has(normalizeMusicPlayerCompareText(primary, locale))
	) {
		return primary;
	}
	let suffix = 2;
	while (suffix < 5000) {
		const candidate = labels.formatIndexed(normalizedBase, suffix);
		if (
			!existingNamesLower.has(
				normalizeMusicPlayerCompareText(candidate, locale)
			)
		) {
			return candidate;
		}
		suffix += 1;
	}
	return labels.formatIndexed(normalizedBase, Date.now());
}
