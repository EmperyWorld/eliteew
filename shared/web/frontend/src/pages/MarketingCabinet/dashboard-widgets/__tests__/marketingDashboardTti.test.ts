import { describe, expect, it } from 'vitest';
import { countVisibleMarketingDashboardWidgets } from '../marketingDashboardTti';

describe('countVisibleMarketingDashboardWidgets', () => {
	it('counts only visible widgets', () => {
		expect(
			countVisibleMarketingDashboardWidgets([
				{ is_visible: true },
				{ is_visible: false },
				{},
			])
		).toBe(1);
	});

	it('returns 0 for empty list', () => {
		expect(countVisibleMarketingDashboardWidgets([])).toBe(0);
	});
});
