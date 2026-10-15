/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock pure Users hub directory query builders after extract from filters hook.
 *
 * Related:
 * - pages/Admin/users/adminUsersDirectoryQuery.ts
 */

import { describe, expect, it } from 'vitest';
import {
	buildAdminUsersDirectoryQueryParams,
	hasActiveAdminUsersDirectoryFilters,
	parseSortForDirectoryQuery,
} from '../users/adminUsersDirectoryQuery';
import { DEFAULT_ADMIN_USERS_FILTERS } from '../adminUsersFilterPresets';

describe('adminUsersDirectoryQuery', () => {
	it('builds API params from directory input', () => {
		const { sort_by, sort_dir } = parseSortForDirectoryQuery(
			DEFAULT_ADMIN_USERS_FILTERS.sortValue
		);
		const params = buildAdminUsersDirectoryQueryParams({
			debouncedSearch: 'alice',
			roleFilter: 'admin',
			activeFilter: 'all',
			trustedFilter: 'all',
			verifiedFilter: 'all',
			onlineOnly: true,
			groupFilter: '',
			anomalyOnly: false,
			ssoBrowserOnly: false,
			ssoMobileOnly: false,
			ssoDesktopOnly: false,
			mismatchOnly: false,
			sortValue: DEFAULT_ADMIN_USERS_FILTERS.sortValue,
			sort_by,
			sort_dir,
		});
		expect(params.search).toBe('alice');
		expect(params.role).toBe('admin');
		expect(params.online_only).toBe(true);
	});

	it('detects active filters vs defaults', () => {
		const idle = {
			debouncedSearch: '',
			roleFilter: '',
			activeFilter: 'all' as const,
			trustedFilter: 'all' as const,
			verifiedFilter: 'all' as const,
			onlineOnly: false,
			groupFilter: '',
			anomalyOnly: false,
			ssoBrowserOnly: false,
			ssoMobileOnly: false,
			ssoDesktopOnly: false,
			mismatchOnly: false,
			sortValue: DEFAULT_ADMIN_USERS_FILTERS.sortValue,
		};
		expect(hasActiveAdminUsersDirectoryFilters(idle)).toBe(false);
		expect(
			hasActiveAdminUsersDirectoryFilters({ ...idle, mismatchOnly: true })
		).toBe(true);
	});
});
