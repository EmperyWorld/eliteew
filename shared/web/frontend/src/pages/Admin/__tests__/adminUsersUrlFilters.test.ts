/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users URL filter serialization.
 *
 * Related:
 * - `pages/Admin/adminUsersUrlFilters.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	buildAdminUsersSearchParams,
	parseAdminUsersUrl,
} from '../adminUsersUrlFilters';
import { DEFAULT_ADMIN_USERS_FILTERS } from '../adminUsersFilterPresets';

describe('adminUsersUrlFilters', () => {
	it('round-trips trusted filter and sort', () => {
		const sp = buildAdminUsersSearchParams(
			{
				...DEFAULT_ADMIN_USERS_FILTERS,
				search: 'poet',
				trustedFilter: 'yes',
				sortValue: 'last_login_at:desc',
			},
			{ page: 2, userId: 'uuid-1' }
		);
		const parsed = parseAdminUsersUrl(sp);
		expect(parsed).not.toBeNull();
		expect(parsed?.filters.search).toBe('poet');
		expect(parsed?.filters.trustedFilter).toBe('yes');
		expect(parsed?.filters.sortValue).toBe('last_login_at:desc');
		expect(parsed?.page).toBe(2);
		expect(parsed?.userId).toBe('uuid-1');
	});

	it('prefills search from userId when q missing', () => {
		const sp = new URLSearchParams('section=users&userId=abc-def');
		const parsed = parseAdminUsersUrl(sp);
		expect(parsed?.filters.search).toBe('abc-def');
	});

	it('round-trips userTab and channel mismatch filter', () => {
		const sp = buildAdminUsersSearchParams(
			{ ...DEFAULT_ADMIN_USERS_FILTERS, mismatchOnly: true },
			{
				userId: 'uuid-1',
				userTab: 'sessions',
			}
		);
		expect(sp.get('userTab')).toBe('sessions');
		expect(sp.get('mismatch')).toBe('1');
		const parsed = parseAdminUsersUrl(sp);
		expect(parsed?.userTab).toBe('sessions');
		expect(parsed?.filters.mismatchOnly).toBe(true);
	});

	it('round-trips online hub view', () => {
		const sp = buildAdminUsersSearchParams(DEFAULT_ADMIN_USERS_FILTERS, {
			view: 'online',
		});
		expect(sp.get('view')).toBe('online');
		const parsed = parseAdminUsersUrl(sp);
		expect(parsed?.view).toBe('online');
	});
});
