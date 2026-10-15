/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral coverage for App Store catalog filter state — clearFilters and
 * filtersActive derivation.
 *
 * Related:
 * - ../useAppStoreCatalogState.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import {
	APP_STORE_FILTERS_SESSION_KEY,
	persistAppStoreFilters,
} from '../appStoreFiltersSession';
import { useAppStoreCatalogState } from '../useAppStoreCatalogState';
import { storeAppFixture } from './storeAppFixture';

describe('useAppStoreCatalogState', () => {
	afterEach(() => {
		sessionStorage.removeItem(APP_STORE_FILTERS_SESSION_KEY);
	});

	const apps = [
		storeAppFixture({
			app_id: 'a1',
			name: 'Alpha',
			category: 'productivity',
			installed: true,
		}),
		storeAppFixture({
			app_id: 'a2',
			name: 'Beta',
			category: 'widgets',
			installed: false,
			show_new_badge: true,
		}),
	];

	it('filtersActive is false by default and true when a filter is set', () => {
		const { result } = renderHook(() =>
			useAppStoreCatalogState({
				apps,
				isOpen: true,
				isLoading: false,
				variant: 'page',
			})
		);

		expect(result.current.filtersActive).toBe(false);

		act(() => {
			result.current.selectViewFilterInstalled();
		});
		expect(result.current.filtersActive).toBe(true);
		expect(result.current.viewFilter).toBe('installed');

		act(() => {
			result.current.selectSortName();
		});
		expect(result.current.sortMode).toBe('name');
		expect(result.current.filtersActive).toBe(true);
	});

	it('clearStoreFilters resets category, view, search, and sort', () => {
		vi.useFakeTimers();
		persistAppStoreFilters({
			activeCategory: 'widgets',
			viewFilter: 'available',
			searchQuery: 'clock',
			sortMode: 'price',
		});

		const { result } = renderHook(() =>
			useAppStoreCatalogState({
				apps,
				isOpen: true,
				isLoading: false,
				variant: 'modal',
			})
		);

		expect(result.current.activeCategory).toBe('widgets');
		expect(result.current.viewFilter).toBe('available');
		expect(result.current.searchQuery).toBe('clock');
		expect(result.current.sortMode).toBe('price');
		expect(result.current.filtersActive).toBe(true);

		act(() => {
			result.current.clearStoreFilters();
		});

		expect(result.current.activeCategory).toBe('all');
		expect(result.current.viewFilter).toBe('all');
		expect(result.current.searchQuery).toBe('');
		expect(result.current.sortMode).toBe('catalog');

		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(result.current.filtersActive).toBe(false);
		vi.useRealTimers();
	});

	it('handleAppNavigate notifies onAppClick', () => {
		const onAppClick = vi.fn();
		const { result } = renderHook(() =>
			useAppStoreCatalogState({
				apps,
				isOpen: true,
				isLoading: false,
				variant: 'page',
				onAppClick,
			})
		);

		act(() => {
			result.current.handleAppNavigate('a1');
		});
		expect(onAppClick).toHaveBeenCalledWith('a1');
	});
});
