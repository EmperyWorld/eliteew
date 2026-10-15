import { describe, expect, it } from 'vitest';
import {
	buildAppsByCategory,
	computeStoreCatalogCounts,
	filterStoreApps,
	sortStoreCategoryKeys,
} from '../appStoreCatalogQuery';
import { storeAppFixture } from './storeAppFixture';

describe('appStoreCatalogQuery', () => {
	const catalog = [
		storeAppFixture({
			app_id: 'chat',
			name: 'Chat',
			category: 'communication',
			installed: true,
			description: 'Team chat',
		}),
		storeAppFixture({
			app_id: 'notes',
			name: 'Notes',
			category: 'productivity',
			installed: false,
		}),
		storeAppFixture({
			app_id: 'clock',
			name: 'Clock',
			category: 'widgets',
			installed: false,
		}),
	];

	it('filterStoreApps applies category, search, and installed view', () => {
		expect(
			filterStoreApps(catalog, {
				activeCategory: 'communication',
				debouncedSearch: '',
				viewFilter: 'all',
			}).map((a) => a.app_id)
		).toEqual(['chat']);

		expect(
			filterStoreApps(catalog, {
				activeCategory: 'all',
				debouncedSearch: 'team',
				viewFilter: 'all',
			}).map((a) => a.app_id)
		).toEqual(['chat']);

		expect(
			filterStoreApps(catalog, {
				activeCategory: 'all',
				debouncedSearch: '',
				viewFilter: 'available',
			}).map((a) => a.app_id)
		).toEqual(['notes', 'clock']);
	});

	it('buildAppsByCategory groups and sorts each bucket', () => {
		const filtered = filterStoreApps(catalog, {
			activeCategory: 'all',
			debouncedSearch: '',
			viewFilter: 'all',
		});
		const map = buildAppsByCategory(filtered, 'name');
		expect([...map.keys()].sort()).toEqual([
			'communication',
			'productivity',
			'widgets',
		]);
		expect(map.get('widgets')?.map((a) => a.app_id)).toEqual(['clock']);
	});

	it('sortStoreCategoryKeys follows canonical order then unknown categories', () => {
		const map = buildAppsByCategory(catalog, 'catalog');
		expect(sortStoreCategoryKeys(map)).toEqual([
			'communication',
			'productivity',
			'widgets',
		]);
	});

	it('computeStoreCatalogCounts aggregates per category and install state', () => {
		const { categoryTotals, installedCount, availableCount } =
			computeStoreCatalogCounts(catalog);
		expect(categoryTotals.get('communication')).toBe(1);
		expect(categoryTotals.get('productivity')).toBe(1);
		expect(installedCount).toBe(1);
		expect(availableCount).toBe(2);
	});
});
