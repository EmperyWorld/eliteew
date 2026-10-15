/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin user detail tab URL helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	adminUserDetailTabToUrlParam,
	normalizeAdminUserDetailTab,
} from '../adminUsersDetailTab';

describe('adminUsersDetailTab', () => {
	it('normalizes unknown to overview', () => {
		expect(normalizeAdminUserDetailTab('')).toBe('overview');
		expect(normalizeAdminUserDetailTab('sessions')).toBe('sessions');
	});

	it('serializes only non-overview tabs', () => {
		expect(adminUserDetailTabToUrlParam('overview')).toBeNull();
		expect(adminUserDetailTabToUrlParam('store')).toBe('store');
	});
});
