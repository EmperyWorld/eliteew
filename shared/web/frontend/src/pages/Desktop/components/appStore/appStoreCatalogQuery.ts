/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derive filtered and grouped App Store catalog lists from raw API apps and UI filter state.
 *
 * Invariants:
 * - Filtering runs before per-section sort; grouping uses unsorted filter output then sorts each bucket.
 *
 * Related:
 * - AppStore.tsx, appStoreCatalogSort.ts
 */

import type { StoreAppResponse } from '../../services/desktopApi';
import { applyStoreSortMode } from './appStoreCatalogSort';
import {
	STORE_CATEGORY_ORDER,
	type StoreCatalogFilterInput,
	type StoreSortMode,
} from './appStoreCatalogTypes';

export function filterStoreApps(
	apps: StoreAppResponse[],
	{ activeCategory, debouncedSearch, viewFilter }: StoreCatalogFilterInput
): StoreAppResponse[] {
	let list = apps;
	if (activeCategory !== 'all') {
		list = list.filter((a) => a.category === activeCategory);
	}
	if (debouncedSearch) {
		const q = debouncedSearch.toLowerCase();
		list = list.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				a.app_id.toLowerCase().includes(q) ||
				(a.description?.toLowerCase().includes(q) ?? false)
		);
	}
	if (viewFilter === 'installed') {
		list = list.filter((a) => a.installed);
	} else if (viewFilter === 'available') {
		list = list.filter((a) => !a.installed);
	}
	return list;
}

export function buildAppsByCategory(
	filteredAppsUnsorted: StoreAppResponse[],
	sortMode: StoreSortMode
): Map<string, StoreAppResponse[]> {
	const map = new Map<string, StoreAppResponse[]>();
	for (const app of filteredAppsUnsorted) {
		const list = map.get(app.category) ?? [];
		list.push(app);
		map.set(app.category, list);
	}
	for (const cat of [...map.keys()]) {
		const list = map.get(cat);
		if (list) {
			map.set(cat, applyStoreSortMode(list, sortMode));
		}
	}
	return map;
}

export function sortStoreCategoryKeys(
	appsByCategory: Map<string, StoreAppResponse[]>
): string[] {
	const seen = new Set(appsByCategory.keys());
	const orderSet = new Set<string>(STORE_CATEGORY_ORDER);
	return [
		...STORE_CATEGORY_ORDER.filter((c) => seen.has(c)),
		...[...seen].filter((c) => !orderSet.has(c)),
	];
}

export function computeStoreCatalogCounts(apps: StoreAppResponse[]): {
	categoryTotals: Map<string, number>;
	installedCount: number;
	availableCount: number;
} {
	const categoryTotals = new Map<string, number>();
	let installedCount = 0;
	let availableCount = 0;
	for (const a of apps) {
		categoryTotals.set(a.category, (categoryTotals.get(a.category) ?? 0) + 1);
		if (a.installed) {
			installedCount += 1;
		} else {
			availableCount += 1;
		}
	}
	return { categoryTotals, installedCount, availableCount };
}
