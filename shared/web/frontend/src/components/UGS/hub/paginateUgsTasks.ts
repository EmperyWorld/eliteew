/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side pagination helper for UGS Hub history/results tabs.
 *
 * Related:
 * - components/UGS/hub/UgsHubPaginatedTasksTab.tsx
 */

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';

import type { UgsHubPaginatedSlice } from './types';

export function paginateUgsTasks(
	list: UGSTask[],
	page: number,
	itemsPerPage: number
): UgsHubPaginatedSlice {
	const totalItems = list.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
	const safePage = Math.min(Math.max(1, page), totalPages);
	const startIndex = (safePage - 1) * itemsPerPage;
	return {
		items: list.slice(startIndex, startIndex + itemsPerPage),
		totalPages,
		totalItems,
		hasPagination: totalItems > itemsPerPage,
		page: safePage,
	};
}
