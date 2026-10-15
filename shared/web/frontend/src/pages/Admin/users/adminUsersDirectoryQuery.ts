/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure builders for Users hub directory API query params, filter key, and active-filter predicate.
 *
 * Invariants:
 * - No React; safe to unit-test without DOM.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 */

import {
	parseAdminDirectorySortValue,
	type AdminDirectorySortBy,
	type AdminDirectorySortDir,
} from '../adminDirectorySort';
import {
	DEFAULT_ADMIN_USERS_FILTERS,
	triFilterToApiBool,
	type AdminUsersFilterSnapshot,
} from '../adminUsersFilterPresets';
import type {
	AdminUsersDirectoryFilterKey,
	AdminUsersDirectoryQueryParams,
} from './adminUsersHubFiltersTypes';

export type AdminUsersDirectoryQueryInput = {
	debouncedSearch: string;
	roleFilter: string;
	activeFilter: AdminUsersFilterSnapshot['activeFilter'];
	trustedFilter: AdminUsersFilterSnapshot['trustedFilter'];
	verifiedFilter: AdminUsersFilterSnapshot['verifiedFilter'];
	onlineOnly: boolean;
	groupFilter: string;
	anomalyOnly: boolean;
	ssoBrowserOnly: boolean;
	ssoMobileOnly: boolean;
	ssoDesktopOnly: boolean;
	mismatchOnly: boolean;
	sortValue: string;
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
};

export function buildAdminUsersDirectoryQueryParams(
	input: AdminUsersDirectoryQueryInput
): AdminUsersDirectoryQueryParams {
	return {
		search: input.debouncedSearch || undefined,
		role: input.roleFilter.trim() || undefined,
		is_active: triFilterToApiBool(input.activeFilter) ?? undefined,
		is_trusted: triFilterToApiBool(input.trustedFilter) ?? undefined,
		is_verified: triFilterToApiBool(input.verifiedFilter) ?? undefined,
		online_only: input.onlineOnly,
		app_access_group_id: input.groupFilter.trim() || undefined,
		presence_anomaly_only: input.anomalyOnly,
		sso_browser_active_only: input.ssoBrowserOnly,
		sso_mobile_active_only: input.ssoMobileOnly,
		sso_desktop_active_only: input.ssoDesktopOnly,
		channel_mismatch_only: input.mismatchOnly,
		sort_by: input.sort_by,
		sort_dir: input.sort_dir,
	};
}

export function buildAdminUsersDirectoryFilterKey(
	input: Omit<AdminUsersDirectoryQueryInput, 'sort_by' | 'sort_dir'>
): AdminUsersDirectoryFilterKey {
	return {
		search: input.debouncedSearch,
		role: input.roleFilter.trim(),
		activeFilter: input.activeFilter,
		trustedFilter: input.trustedFilter,
		verifiedFilter: input.verifiedFilter,
		onlineOnly: input.onlineOnly,
		groupFilter: input.groupFilter,
		anomalyOnly: input.anomalyOnly,
		ssoBrowserOnly: input.ssoBrowserOnly,
		ssoMobileOnly: input.ssoMobileOnly,
		ssoDesktopOnly: input.ssoDesktopOnly,
		mismatchOnly: input.mismatchOnly,
		sortValue: input.sortValue,
	};
}

export function hasActiveAdminUsersDirectoryFilters(
	input: Omit<AdminUsersDirectoryQueryInput, 'sort_by' | 'sort_dir'>
): boolean {
	return (
		Boolean(input.debouncedSearch.trim()) ||
		Boolean(input.roleFilter.trim()) ||
		input.activeFilter !== 'all' ||
		input.trustedFilter !== 'all' ||
		input.verifiedFilter !== 'all' ||
		input.onlineOnly ||
		Boolean(input.groupFilter.trim()) ||
		input.anomalyOnly ||
		input.ssoBrowserOnly ||
		input.ssoMobileOnly ||
		input.ssoDesktopOnly ||
		input.mismatchOnly ||
		input.sortValue !== DEFAULT_ADMIN_USERS_FILTERS.sortValue
	);
}

/** Parse sort once for query builders that need sort_by / sort_dir. */
export function parseSortForDirectoryQuery(sortValue: string): {
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
} {
	return parseAdminDirectorySortValue(sortValue);
}
