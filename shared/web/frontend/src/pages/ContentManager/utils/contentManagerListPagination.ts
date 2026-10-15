/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve list footer totals for Content Manager pagination.
 *
 * Invariants:
 * - API totals are authoritative; size/processing_status filters are server-side.
 * - `hasContentManagerClientListFilters` always returns false (legacy helper).
 *
 * Related:
 * - ContentManagerFilesPagination.tsx
 * - useContentManagerFileGroups.ts
 */

export type ResolveContentManagerListPaginationTotalParams = {
	apiTotalItems: number;
	filteredVisibleCount: number;
	hasClientListFilters: boolean;
};

/** Footer total aligned with empty state / visible rows when client filters apply. */
export function resolveContentManagerListPaginationTotal({
	apiTotalItems,
	filteredVisibleCount,
	hasClientListFilters,
}: ResolveContentManagerListPaginationTotalParams): number {
	if (hasClientListFilters) {
		return filteredVisibleCount;
	}
	return apiTotalItems;
}

/**
 * Legacy helper: size / processing_status filters are applied on GET /content.
 * Always returns false for Content Manager list pagination.
 */
export function hasContentManagerClientListFilters(
	_clientMinFileSize: number | null,
	_clientProcessingStatusFilter: string | null
): boolean {
	return false;
}

export function matchesProcessingStatusFilter(
	itemStatus: string | null | undefined,
	filter: string | null
): boolean {
	if (!filter?.trim()) return true;
	return String(itemStatus ?? '').toLowerCase() === filter.trim().toLowerCase();
}
