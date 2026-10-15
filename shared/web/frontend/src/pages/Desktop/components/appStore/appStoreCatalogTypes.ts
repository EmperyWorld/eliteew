/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared catalog filter/sort types for the desktop App Store vitrine.
 *
 * Invariants:
 * - Session filter shape matches `APP_STORE_FILTERS_SESSION_KEY` JSON in sessionStorage.
 *
 * Related:
 * - AppStore.tsx, appStoreFiltersSession.ts
 */

import type { ComponentType } from 'react';

export type StoreViewFilter = 'all' | 'installed' | 'available';

export type StoreSortMode = 'catalog' | 'name' | 'price';

export type StoreCategoryDef = {
	id: string;
	name: string;
	icon: ComponentType<{ size?: number; className?: string }>;
};

export type StoredAppStoreFilters = {
	activeCategory?: string;
	viewFilter?: StoreViewFilter;
	searchQuery?: string;
	sortMode?: StoreSortMode;
};

export type StoreCatalogFilterInput = {
	activeCategory: string | 'all';
	debouncedSearch: string;
	viewFilter: StoreViewFilter;
};

export const STORE_CATEGORY_ORDER = [
	'communication',
	'productivity',
	'widgets',
	'home',
	'developer',
	'system',
] as const;
