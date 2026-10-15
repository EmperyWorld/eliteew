import { describe, expect, it } from 'vitest';

import {
	MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE,
	readDashboardToolbarExpandedPreference,
} from '../overviewInteractiveDashboardConstants';

describe('readDashboardToolbarExpandedPreference', () => {
	it('defaults collapsed when storage is empty or not explicitly expanded', () => {
		expect(readDashboardToolbarExpandedPreference(() => null)).toBe(false);
		expect(readDashboardToolbarExpandedPreference(() => '0')).toBe(false);
		expect(readDashboardToolbarExpandedPreference(() => '')).toBe(false);
	});

	it('expands only when storage value is 1', () => {
		expect(
			readDashboardToolbarExpandedPreference((key) => {
				expect(key).toBe(MC_DASHBOARD_TOOLBAR_EXPANDED_STORAGE);
				return '1';
			})
		).toBe(true);
	});

	it('defaults collapsed when getItem throws', () => {
		expect(
			readDashboardToolbarExpandedPreference(() => {
				throw new Error('quota');
			})
		).toBe(false);
	});
});
