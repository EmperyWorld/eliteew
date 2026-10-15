/**
 * Tests pagination total resolver and processing-status client filter helper.
 */
import { describe, expect, it } from 'vitest';
import {
	hasContentManagerClientListFilters,
	matchesProcessingStatusFilter,
	resolveContentManagerListPaginationTotal,
} from './contentManagerListPagination';

describe('resolveContentManagerListPaginationTotal', () => {
	it('uses API total when no client filters are active', () => {
		expect(
			resolveContentManagerListPaginationTotal({
				apiTotalItems: 28,
				filteredVisibleCount: 0,
				hasClientListFilters: false,
			})
		).toBe(28);
	});

	it('uses visible count when client filters hide rows', () => {
		expect(
			resolveContentManagerListPaginationTotal({
				apiTotalItems: 28,
				filteredVisibleCount: 3,
				hasClientListFilters: true,
			})
		).toBe(3);
	});
});

describe('matchesProcessingStatusFilter', () => {
	it('matches failed status case-insensitively', () => {
		expect(matchesProcessingStatusFilter('FAILED', 'failed')).toBe(true);
		expect(matchesProcessingStatusFilter('completed', 'failed')).toBe(false);
	});
});

describe('hasContentManagerClientListFilters', () => {
	it('always returns false (filters are server-side)', () => {
		expect(hasContentManagerClientListFilters(null, null)).toBe(false);
		expect(hasContentManagerClientListFilters(1024, null)).toBe(false);
		expect(hasContentManagerClientListFilters(null, 'failed')).toBe(false);
	});
});
