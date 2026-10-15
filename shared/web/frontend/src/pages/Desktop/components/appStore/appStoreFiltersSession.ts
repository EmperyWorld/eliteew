/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session-scoped persistence for App Store catalog filters (category, search, view, sort).
 *
 * Invariants:
 * - Key `eliteew-desktop-app-store-filters` is stable for the browser session; invalid JSON is ignored on read.
 *
 * Related:
 * - AppStore.tsx, documentation/product/desktop/DESKTOP-APP-STORE.md
 */

import type {
	StoredAppStoreFilters,
	StoreSortMode,
	StoreViewFilter,
} from './appStoreCatalogTypes';

export const APP_STORE_FILTERS_SESSION_KEY =
	'eliteew-desktop-app-store-filters';

export const APP_STORE_CATALOG_SCROLL_KEY =
	'eliteew-desktop-app-store-catalog-scroll';

function isStoreViewFilter(value: unknown): value is StoreViewFilter {
	return value === 'all' || value === 'installed' || value === 'available';
}

function isStoreSortMode(value: unknown): value is StoreSortMode {
	return value === 'catalog' || value === 'name' || value === 'price';
}

export function readStoredAppStoreFilters(): StoredAppStoreFilters | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(APP_STORE_FILTERS_SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		return {
			activeCategory:
				typeof parsed.activeCategory === 'string'
					? parsed.activeCategory
					: undefined,
			viewFilter: isStoreViewFilter(parsed.viewFilter)
				? parsed.viewFilter
				: undefined,
			searchQuery:
				typeof parsed.searchQuery === 'string' ? parsed.searchQuery : undefined,
			sortMode: isStoreSortMode(parsed.sortMode) ? parsed.sortMode : undefined,
		};
	} catch {
		return null;
	}
}

export function persistAppStoreFilters(filters: StoredAppStoreFilters): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(
			APP_STORE_FILTERS_SESSION_KEY,
			JSON.stringify(filters)
		);
	} catch {
		// ignore quota / private mode
	}
}

export function readInitialActiveCategory(): string | 'all' {
	const stored = readStoredAppStoreFilters();
	const ac = stored?.activeCategory;
	if (ac === 'all') return 'all';
	if (typeof ac === 'string' && ac.length > 0) return ac;
	return 'all';
}
