/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Partition selected Content Manager items into bulk-action eligible vs blocked rows.
 *
 * Invariants:
 * - Default action scope is owner-editable rows (`is_owner !== false`, `can_edit !== false`).
 * - Unknown selected ids are ignored.
 *
 * Related:
 * - `ContentManagerPro.tsx` bulk move/delete flows
 */

import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

export type BulkEligibilityReason = 'read_only' | 'not_owner';

export type BulkIneligibleItem = {
	item: ContentItem;
	reason: BulkEligibilityReason;
};

export type BulkEligibilityPartition = {
	eligible: ContentItem[];
	ineligible: BulkIneligibleItem[];
};

export type DeleteEligibilityPartition = {
	eligible: ContentItem[];
	ineligible: ContentItem[];
};

function normalizeSelectedIds(
	selectedIds: ReadonlySet<string> | readonly string[]
): Set<string> {
	if (selectedIds instanceof Set) {
		return selectedIds;
	}
	return new Set(selectedIds);
}

export function partitionSelectedByEligibility(
	items: readonly ContentItem[],
	selectedIds: ReadonlySet<string> | readonly string[]
): BulkEligibilityPartition {
	const ids = normalizeSelectedIds(selectedIds);
	const byId = new Map(items.map((item) => [item.id, item] as const));

	const eligible: ContentItem[] = [];
	const ineligible: BulkIneligibleItem[] = [];

	for (const id of ids) {
		const item = byId.get(id);
		if (!item) continue;

		if (item.is_owner === false) {
			ineligible.push({ item, reason: 'not_owner' });
			continue;
		}
		if (item.can_edit === false) {
			ineligible.push({ item, reason: 'read_only' });
			continue;
		}
		eligible.push(item);
	}

	return { eligible, ineligible };
}

export function partitionSelectedByDeleteEligibility(
	items: readonly ContentItem[],
	selectedIds: ReadonlySet<string> | readonly string[]
): DeleteEligibilityPartition {
	const ids = normalizeSelectedIds(selectedIds);
	const byId = new Map(items.map((item) => [item.id, item] as const));
	const eligible: ContentItem[] = [];
	const ineligible: ContentItem[] = [];

	for (const id of ids) {
		const item = byId.get(id);
		if (!item) continue;
		if (item.can_delete === false) {
			ineligible.push(item);
		} else {
			eligible.push(item);
		}
	}

	return { eligible, ineligible };
}
