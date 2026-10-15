import { afterEach, describe, expect, it } from 'vitest';
import {
	APP_STORE_FILTERS_SESSION_KEY,
	persistAppStoreFilters,
	readInitialActiveCategory,
	readStoredAppStoreFilters,
} from '../appStoreFiltersSession';

describe('appStoreFiltersSession', () => {
	afterEach(() => {
		sessionStorage.removeItem(APP_STORE_FILTERS_SESSION_KEY);
	});

	it('readStoredAppStoreFilters returns null for missing or invalid JSON', () => {
		expect(readStoredAppStoreFilters()).toBeNull();
		sessionStorage.setItem(APP_STORE_FILTERS_SESSION_KEY, '{not json');
		expect(readStoredAppStoreFilters()).toBeNull();
	});

	it('persist and read round-trip valid filter fields', () => {
		persistAppStoreFilters({
			activeCategory: 'widgets',
			viewFilter: 'installed',
			searchQuery: 'clock',
			sortMode: 'name',
		});

		expect(readStoredAppStoreFilters()).toEqual({
			activeCategory: 'widgets',
			viewFilter: 'installed',
			searchQuery: 'clock',
			sortMode: 'name',
		});
	});

	it('readStoredAppStoreFilters ignores unknown enum values', () => {
		sessionStorage.setItem(
			APP_STORE_FILTERS_SESSION_KEY,
			JSON.stringify({
				viewFilter: 'bogus',
				sortMode: 'bogus',
			})
		);

		expect(readStoredAppStoreFilters()).toEqual({});
	});

	it('readInitialActiveCategory defaults to all', () => {
		expect(readInitialActiveCategory()).toBe('all');
		persistAppStoreFilters({ activeCategory: 'home' });
		expect(readInitialActiveCategory()).toBe('home');
	});
});
