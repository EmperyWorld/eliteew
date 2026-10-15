/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users hub view normalization.
 */

import { describe, expect, it } from 'vitest';
import {
	adminUsersHubViewToUrlParam,
	normalizeAdminUsersHubView,
} from '../adminUsersHubView';

describe('adminUsersHubView', () => {
	it('defaults unknown to catalog', () => {
		expect(normalizeAdminUsersHubView('')).toBe('catalog');
		expect(normalizeAdminUsersHubView('online')).toBe('online');
	});

	it('serializes only online to URL', () => {
		expect(adminUsersHubViewToUrlParam('catalog')).toBeNull();
		expect(adminUsersHubViewToUrlParam('online')).toBe('online');
	});
});
