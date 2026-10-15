/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Catalog filter/search/sort state, derived lists, session persistence, and
 * scroll/focus effects for the desktop App Store vitrine.
 *
 * Invariants:
 * - Filter fields persist to sessionStorage while the store is open.
 * - `/` focuses catalog search when focus is not already in a field.
 * - Page variant restores catalog scroll from sessionStorage after load.
 *
 * Related:
 * - AppStore.tsx, appStoreFiltersSession.ts, appStoreCatalogQuery.ts
 */

import { DEFAULT_APPS } from '../../constants';
import type { StoreAppResponse } from '../../services/desktopApi';
import {
	pushRecentlyViewedAppId,
	readRecentlyViewedAppIds,
} from '../../utils/appStoreRecentlyViewed';
import { handleSearchFieldEscapeKeyDown } from '../../hooks/useShellCaptureKeyboard';
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent,
	type ReactNode,
	type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { buildStoreCategories, categoryLabel } from './appStoreCategories';
import {
	buildAppsByCategory,
	computeStoreCatalogCounts,
	filterStoreApps,
	sortStoreCategoryKeys,
} from './appStoreCatalogQuery';
import {
	applyStoreSortMode,
	sortAppsByCatalogOrder,
} from './appStoreCatalogSort';
import type {
	StoreCategoryDef,
	StoreSortMode,
	StoreViewFilter,
} from './appStoreCatalogTypes';
import {
	APP_STORE_CATALOG_SCROLL_KEY,
	persistAppStoreFilters,
	readInitialActiveCategory,
	readStoredAppStoreFilters,
} from './appStoreFiltersSession';
import { useDebouncedValue } from './useDebouncedValue';

export type UseAppStoreCatalogStateParams = {
	apps: StoreAppResponse[];
	isOpen: boolean;
	isLoading: boolean;
	variant: 'modal' | 'page';
	onAppClick?: (appId: string) => void;
};

export type AppStoreCategoryJumpItem = {
	id: string;
	label: string;
	count: number;
};

export type AppStoreSuggestedEmptyCategory = {
	id: string;
	label: string;
	count: number;
};

export type UseAppStoreCatalogStateResult = {
	mainScrollRef: RefObject<HTMLDivElement | null>;
	searchInputRef: RefObject<HTMLInputElement | null>;
	searchFieldId: string;
	activeCategory: string | 'all';
	viewFilter: StoreViewFilter;
	searchQuery: string;
	sortMode: StoreSortMode;
	debouncedSearch: string;
	filtersActive: boolean;
	filteredApps: StoreAppResponse[];
	appsByCategory: Map<string, StoreAppResponse[]>;
	sortedCategories: string[];
	storeCategories: StoreCategoryDef[];
	visibleStoreCategories: StoreCategoryDef[];
	categoryTotals: Map<string, number>;
	installedCount: number;
	availableCount: number;
	featuredApps: StoreAppResponse[];
	recentlyViewedApps: StoreAppResponse[];
	suggestedEmptyCategories: AppStoreSuggestedEmptyCategory[];
	categoryJumpItems: AppStoreCategoryJumpItem[];
	defaultIconsMap: Map<string, ReactNode>;
	clearStoreFilters: () => void;
	clearSearchQuery: () => void;
	clearActiveCategory: () => void;
	onSearchInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
	onSearchKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
	selectViewFilterAll: () => void;
	selectViewFilterInstalled: () => void;
	selectViewFilterAvailable: () => void;
	selectSortCatalog: () => void;
	selectSortName: () => void;
	selectSortPrice: () => void;
	selectCategoryById: (categoryId: string) => void;
	handleCategoryNavClick: (e: MouseEvent<HTMLButtonElement>) => void;
	handleAppNavigate: (appId: string) => void;
	categoryHintText: (categoryId: string) => string;
};

export function useAppStoreCatalogState({
	apps,
	isOpen,
	isLoading,
	variant,
	onAppClick,
}: UseAppStoreCatalogStateParams): UseAppStoreCatalogStateResult {
	const { t } = useTranslation('appStore');
	const { t: tDesktopUi } = useTranslation('desktopUi');

	const [recentViewTick, setRecentViewTick] = useState(0);
	const [activeCategory, setActiveCategory] = useState<string | 'all'>(
		readInitialActiveCategory
	);
	const [viewFilter, setViewFilter] = useState<StoreViewFilter>(
		() => readStoredAppStoreFilters()?.viewFilter ?? 'all'
	);
	const [searchQuery, setSearchQuery] = useState(
		() => readStoredAppStoreFilters()?.searchQuery ?? ''
	);
	const [sortMode, setSortMode] = useState<StoreSortMode>(
		() => readStoredAppStoreFilters()?.sortMode ?? 'catalog'
	);
	const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
	const searchFieldId = useId();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const mainScrollRef = useRef<HTMLDivElement>(null);

	const categoryHintText = useCallback(
		(categoryId: string) =>
			tDesktopUi(`appCategoryHints.${categoryId}`, { defaultValue: '' }).trim(),
		[tDesktopUi]
	);

	const storeCategories = useMemo(() => buildStoreCategories(t), [t]);

	useEffect(() => {
		if (!isOpen) return;
		persistAppStoreFilters({
			activeCategory,
			viewFilter,
			searchQuery,
			sortMode,
		});
	}, [isOpen, activeCategory, viewFilter, searchQuery, sortMode]);

	const filteredAppsUnsorted = useMemo(
		() =>
			filterStoreApps(apps, {
				activeCategory,
				debouncedSearch,
				viewFilter,
			}),
		[apps, activeCategory, debouncedSearch, viewFilter]
	);

	const filteredApps = useMemo(
		() => applyStoreSortMode(filteredAppsUnsorted, sortMode),
		[filteredAppsUnsorted, sortMode]
	);

	const appsByCategory = useMemo(
		() => buildAppsByCategory(filteredAppsUnsorted, sortMode),
		[filteredAppsUnsorted, sortMode]
	);

	const sortedCategories = useMemo(
		() => sortStoreCategoryKeys(appsByCategory),
		[appsByCategory]
	);

	const defaultIconsMap = useMemo(
		() => new Map(DEFAULT_APPS.map((a) => [a.id, a.icon])),
		[]
	);

	const { categoryTotals, installedCount, availableCount } = useMemo(
		() => computeStoreCatalogCounts(apps),
		[apps]
	);

	const visibleStoreCategories = useMemo(
		() => storeCategories.filter((c) => (categoryTotals.get(c.id) ?? 0) > 0),
		[storeCategories, categoryTotals]
	);

	const clearStoreFilters = useCallback(() => {
		setActiveCategory('all');
		setViewFilter('all');
		setSearchQuery('');
		setSortMode('catalog');
	}, []);

	const onSearchInputChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			setSearchQuery(e.target.value);
		},
		[]
	);

	const clearSearchQuery = useCallback(() => {
		setSearchQuery('');
	}, []);

	const onSearchKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLInputElement>) => {
			handleSearchFieldEscapeKeyDown(e, searchQuery, clearSearchQuery);
		},
		[searchQuery, clearSearchQuery]
	);

	const selectViewFilterAll = useCallback(() => {
		setViewFilter('all');
	}, []);

	const selectViewFilterInstalled = useCallback(() => {
		setViewFilter('installed');
	}, []);

	const selectViewFilterAvailable = useCallback(() => {
		setViewFilter('available');
	}, []);

	const selectSortCatalog = useCallback(() => {
		setSortMode('catalog');
	}, []);

	const selectSortName = useCallback(() => {
		setSortMode('name');
	}, []);

	const selectSortPrice = useCallback(() => {
		setSortMode('price');
	}, []);

	const selectCategoryById = useCallback((categoryId: string) => {
		setActiveCategory(categoryId === 'all' ? 'all' : categoryId);
	}, []);

	const clearActiveCategory = useCallback(() => {
		setActiveCategory('all');
	}, []);

	const persistCatalogScroll = useCallback(() => {
		if (variant !== 'page') return;
		const top = mainScrollRef.current?.scrollTop ?? 0;
		try {
			sessionStorage.setItem(APP_STORE_CATALOG_SCROLL_KEY, String(top));
		} catch {
			// ignore quota / private mode
		}
	}, [variant]);

	const handleAppNavigate = useCallback(
		(appId: string) => {
			persistCatalogScroll();
			pushRecentlyViewedAppId(appId);
			setRecentViewTick((n) => n + 1);
			onAppClick?.(appId);
		},
		[onAppClick, persistCatalogScroll]
	);

	const categoryJumpItems = useMemo(
		() =>
			sortedCategories.map((cat) => ({
				id: cat,
				label: categoryLabel(cat, t),
				count: appsByCategory.get(cat)?.length ?? 0,
			})),
		[sortedCategories, appsByCategory, t]
	);

	const recentlyViewedApps = useMemo(() => {
		void recentViewTick;
		const byId = new Map(apps.map((a) => [a.app_id, a]));
		return readRecentlyViewedAppIds()
			.map((id) => byId.get(id))
			.filter((a): a is StoreAppResponse => a !== undefined);
	}, [apps, recentViewTick]);

	const suggestedEmptyCategories = useMemo(() => {
		if (filteredApps.length > 0 || apps.length === 0) {
			return [];
		}
		return visibleStoreCategories
			.filter(
				(c) => c.id !== activeCategory && (categoryTotals.get(c.id) ?? 0) > 0
			)
			.map((c) => ({
				id: c.id,
				label: c.name,
				count: categoryTotals.get(c.id) ?? 0,
			}));
	}, [
		filteredApps.length,
		apps.length,
		visibleStoreCategories,
		activeCategory,
		categoryTotals,
	]);

	const handleCategoryNavClick = useCallback(
		(e: MouseEvent<HTMLButtonElement>) => {
			const raw = e.currentTarget.dataset.storeCategory;
			if (raw === undefined) return;
			setActiveCategory(raw);
		},
		[]
	);

	const filtersActive =
		activeCategory !== 'all' ||
		debouncedSearch.length > 0 ||
		viewFilter !== 'all' ||
		sortMode !== 'catalog';

	const featuredApps = useMemo(() => {
		if (filtersActive || activeCategory !== 'all' || isLoading) {
			return [];
		}
		return sortAppsByCatalogOrder(apps.filter((a) => a.show_new_badge)).slice(
			0,
			8
		);
	}, [apps, filtersActive, activeCategory, isLoading]);

	useEffect(() => {
		if (!isOpen || isLoading || variant !== 'page') return;
		let raw: string | null = null;
		try {
			raw = sessionStorage.getItem(APP_STORE_CATALOG_SCROLL_KEY);
		} catch {
			return;
		}
		if (!raw) return;
		const top = Number.parseInt(raw, 10);
		if (!Number.isFinite(top) || top <= 0) return;
		const id = requestAnimationFrame(() => {
			mainScrollRef.current?.scrollTo({ top, behavior: 'auto' });
		});
		return () => cancelAnimationFrame(id);
	}, [isOpen, isLoading, variant]);

	/** `/` focuses catalog search when not typing in a field (modal and page). */
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (
				target?.closest('input, textarea, select, [contenteditable="true"]')
			) {
				return;
			}
			e.preventDefault();
			searchInputRef.current?.focus();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || isLoading) return;
		const el = mainScrollRef.current;
		if (!el) return;
		if (activeCategory === 'all') {
			if (typeof el.scrollTo === 'function') {
				el.scrollTo({ top: 0, behavior: 'smooth' });
			}
			return;
		}
		const id = `store-category-${activeCategory}`;
		requestAnimationFrame(() => {
			document.getElementById(id)?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		});
	}, [activeCategory, isOpen, isLoading]);

	return {
		mainScrollRef,
		searchInputRef,
		searchFieldId,
		activeCategory,
		viewFilter,
		searchQuery,
		sortMode,
		debouncedSearch,
		filtersActive,
		filteredApps,
		appsByCategory,
		sortedCategories,
		storeCategories,
		visibleStoreCategories,
		categoryTotals,
		installedCount,
		availableCount,
		featuredApps,
		recentlyViewedApps,
		suggestedEmptyCategories,
		categoryJumpItems,
		defaultIconsMap,
		clearStoreFilters,
		clearSearchQuery,
		clearActiveCategory,
		onSearchInputChange,
		onSearchKeyDown,
		selectViewFilterAll,
		selectViewFilterInstalled,
		selectViewFilterAvailable,
		selectSortCatalog,
		selectSortName,
		selectSortPrice,
		selectCategoryById,
		handleCategoryNavClick,
		handleAppNavigate,
		categoryHintText,
	};
}
