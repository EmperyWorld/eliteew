/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtual-list sizing helpers for Music Player track rows.
 *
 * Invariants:
 * - Estimated row height should stay close to rendered row variants to reduce initial scroll jumps.
 * - Item keys prefer stable content ids.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 */

import type { Content } from '../../components/UnifiedContent/types';

/** Совпадает с `space-y-0.5` в списке без виртуализации (0.125rem ≈ 2px). */
export const MUSIC_TRACK_ROW_GAP_PX = 2;

/**
 * Оценка высоты строки до измерения в DOM (variable size list).
 * Макет: p-2.5 + h-10 превью + 2–3 строки метаданных + нижний отступ `pb-0.5` как у `space-y-0.5`.
 */
export function estimateMusicTrackRowHeightPx(
	item: Content | undefined,
	density: 'compact' | 'dense' = 'compact'
): number {
	if (!item) return density === 'dense' ? 66 : 72;
	const hasMeta =
		Boolean(item.mime_type?.trim()) ||
		(Array.isArray(item.tags) && item.tags.some((t) => String(t).trim()));
	const contentBlock =
		density === 'dense' ? (hasMeta ? 88 : 70) : hasMeta ? 96 : 74;
	return contentBlock + MUSIC_TRACK_ROW_GAP_PX;
}

export function getMusicTrackItemKey(
	items: readonly Content[],
	index: number
): string | number {
	if (index < 0 || index >= items.length) return index;
	const id = items[index]?.id;
	return id != null && id !== '' ? id : index;
}
