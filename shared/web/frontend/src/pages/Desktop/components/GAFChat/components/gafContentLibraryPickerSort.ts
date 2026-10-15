/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side sort helpers for GAF Chat content-library attachment picker.
 *
 * Invariants:
 * - Sorting is applied only to already-filtered picker rows (no API re-fetch).
 *
 * Related:
 * - GafContentLibraryPickerPanel.tsx
 */
import type { PickerItem } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import { unifiedContentDisplayLabel } from '@/components/UnifiedContent/utils/contentDisplayLabel';

export type GafLibrarySortKey =
	| 'newest'
	| 'oldest'
	| 'name_asc'
	| 'name_desc'
	| 'size_desc';

export function sortGafLibraryPickerItems(
	items: readonly PickerItem[],
	sortKey: GafLibrarySortKey
): PickerItem[] {
	const copy = [...items];
	const byLabel = (a: PickerItem, b: PickerItem) =>
		unifiedContentDisplayLabel(a).localeCompare(
			unifiedContentDisplayLabel(b),
			undefined,
			{ sensitivity: 'base' }
		);
	const byDate = (a: PickerItem, b: PickerItem) =>
		new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
	const bySize = (a: PickerItem, b: PickerItem) =>
		(b.file_size ?? 0) - (a.file_size ?? 0);

	switch (sortKey) {
		case 'oldest':
			return copy.sort((a, b) => -byDate(a, b));
		case 'name_asc':
			return copy.sort(byLabel);
		case 'name_desc':
			return copy.sort((a, b) => -byLabel(a, b));
		case 'size_desc':
			return copy.sort(bySize);
		default:
			return copy.sort(byDate);
	}
}
