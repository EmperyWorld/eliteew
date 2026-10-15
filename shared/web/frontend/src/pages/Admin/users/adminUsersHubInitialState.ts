/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Initial Users hub state from URL or localStorage last filters.
 */

import {
	normalizeAdminUserDetailTab,
	type AdminUserDetailTab,
} from '../adminUsersDetailTab';
import {
	DEFAULT_ADMIN_USERS_FILTERS,
	loadLastAdminUsersFilters,
	type AdminUsersFilterSnapshot,
} from '../adminUsersFilterPresets';
import { parseAdminUsersUrl } from '../adminUsersUrlFilters';
import {
	normalizeAdminUsersHubView,
	type AdminUsersHubView,
} from '../adminUsersHubView';

export function readInitialAdminUsersHubState(): {
	filters: AdminUsersFilterSnapshot;
	page: number;
	view: AdminUsersHubView;
	panelDetailTab: AdminUserDetailTab;
} {
	if (typeof window === 'undefined') {
		return {
			filters: { ...DEFAULT_ADMIN_USERS_FILTERS },
			page: 1,
			view: 'catalog',
			panelDetailTab: 'overview',
		};
	}
	const sp = new URLSearchParams(window.location.search);
	const fromUrl = parseAdminUsersUrl(sp);
	if (fromUrl) {
		return {
			filters: fromUrl.filters,
			page: fromUrl.page,
			view: fromUrl.view,
			panelDetailTab: fromUrl.userTab,
		};
	}
	const last = loadLastAdminUsersFilters();
	return {
		filters: last ?? { ...DEFAULT_ADMIN_USERS_FILTERS },
		page: 1,
		view: normalizeAdminUsersHubView(sp.get('view')),
		panelDetailTab: normalizeAdminUserDetailTab(sp.get('userTab')),
	};
}
