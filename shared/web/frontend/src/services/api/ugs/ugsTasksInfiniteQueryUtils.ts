/**
 * Shared helpers for UGS Hub infinite task queries (offset pages, merge on poll).
 */

import type { UGSTask } from './types';

export const UGS_TASKS_INFINITE_MAX_PAGES = 8;
export const UGS_TASKS_INFINITE_GC_MS = 5 * 60 * 1000;

export function flattenUgsTaskPages(
	pages: readonly UGSTask[][] | undefined
): UGSTask[] {
	return pages?.flat() ?? [];
}

export function resolveCachedUgsTaskPage(
	pages: readonly UGSTask[][] | undefined,
	offset: number,
	limit: number
): UGSTask[] {
	if (!pages?.length || offset === 0) return [];
	const pageIndex = Math.floor(offset / limit);
	return pages[pageIndex] ?? [];
}

export function resolveUgsTasksNextPageParam(
	lastPage: readonly UGSTask[],
	pages: readonly (readonly UGSTask[])[],
	lastPageParam: unknown,
	limit: number
): number | undefined {
	const offset = typeof lastPageParam === 'number' ? lastPageParam : 0;
	if (!lastPage.length || lastPage.length < limit) {
		return undefined;
	}
	if (pages.length >= UGS_TASKS_INFINITE_MAX_PAGES) {
		return undefined;
	}
	return offset + limit;
}
