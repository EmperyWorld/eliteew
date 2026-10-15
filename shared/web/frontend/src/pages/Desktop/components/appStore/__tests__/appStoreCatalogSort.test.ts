import { describe, expect, it } from 'vitest';
import {
	applyStoreSortMode,
	sortAppsByCatalogOrder,
} from '../appStoreCatalogSort';
import { storeAppFixture } from './storeAppFixture';

describe('appStoreCatalogSort', () => {
	it('sortAppsByCatalogOrder prioritizes new badge then sort_order then name', () => {
		const apps = [
			storeAppFixture({ app_id: 'c', name: 'Charlie', sort_order: 1 }),
			storeAppFixture({
				app_id: 'a',
				name: 'Alpha',
				show_new_badge: true,
				sort_order: 5,
			}),
			storeAppFixture({ app_id: 'b', name: 'Bravo', sort_order: 0 }),
		];

		expect(sortAppsByCatalogOrder(apps).map((a) => a.app_id)).toEqual([
			'a',
			'b',
			'c',
		]);
	});

	it('applyStoreSortMode name sorts alphabetically', () => {
		const apps = [
			storeAppFixture({ app_id: 'b', name: 'Bravo' }),
			storeAppFixture({ app_id: 'a', name: 'alpha' }),
		];

		expect(applyStoreSortMode(apps, 'name').map((a) => a.app_id)).toEqual([
			'a',
			'b',
		]);
	});

	it('applyStoreSortMode price puts billing_exempt first then ew_monthly_price', () => {
		const apps = [
			storeAppFixture({
				app_id: 'paid',
				name: 'Paid',
				ew_monthly_price: 10,
			}),
			storeAppFixture({
				app_id: 'free',
				name: 'Free',
				billing_exempt: true,
				ew_monthly_price: 99,
			}),
			storeAppFixture({
				app_id: 'cheap',
				name: 'Cheap',
				ew_monthly_price: 2,
			}),
		];

		expect(applyStoreSortMode(apps, 'price').map((a) => a.app_id)).toEqual([
			'free',
			'cheap',
			'paid',
		]);
	});
});
