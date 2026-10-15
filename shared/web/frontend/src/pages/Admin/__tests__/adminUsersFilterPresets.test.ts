/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users filter snapshot helpers.
 *
 * Related:
 * - `pages/Admin/adminUsersFilterPresets.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	normalizeAdminUsersFilterSnapshot,
	triFilterToApiBool,
	hasNonDefaultAdminUsersFilters,
	DEFAULT_ADMIN_USERS_FILTERS,
} from '../adminUsersFilterPresets';

describe('adminUsersFilterPresets', () => {
	it('maps tri filter to API boolean', () => {
		expect(triFilterToApiBool('all')).toBeNull();
		expect(triFilterToApiBool('yes')).toBe(true);
		expect(triFilterToApiBool('no')).toBe(false);
	});

	it('normalizes partial snapshot', () => {
		const s = normalizeAdminUsersFilterSnapshot({
			trustedFilter: 'yes',
			sortValue: 'invalid',
		});
		expect(s.trustedFilter).toBe('yes');
		expect(s.sortValue).toBe(DEFAULT_ADMIN_USERS_FILTERS.sortValue);
	});

	it('detects non-default filters', () => {
		expect(hasNonDefaultAdminUsersFilters(DEFAULT_ADMIN_USERS_FILTERS)).toBe(
			false
		);
		expect(
			hasNonDefaultAdminUsersFilters({
				...DEFAULT_ADMIN_USERS_FILTERS,
				trustedFilter: 'yes',
			})
		).toBe(true);
		expect(
			hasNonDefaultAdminUsersFilters({
				...DEFAULT_ADMIN_USERS_FILTERS,
				mismatchOnly: true,
			})
		).toBe(true);
	});
});
