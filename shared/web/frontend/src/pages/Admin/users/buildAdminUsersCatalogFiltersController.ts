/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assemble `AdminUsersCatalogFiltersController` for Users hub filter panel.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 */

import type * as React from 'react';
import type { AccessGroupResponse } from '../../Desktop/services/desktopAdminApi';
import type { AdminUsersFilterSnapshot } from '../adminUsersFilterPresets';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';
import type { AdminUsersCatalogFiltersController } from './adminUsersCatalogFiltersTypes';

export type BuildAdminUsersCatalogFiltersControllerInput = {
	search: string;
	setSearch: React.Dispatch<React.SetStateAction<string>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	roleFilter: string;
	setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
	groupFilter: string;
	setGroupFilter: React.Dispatch<React.SetStateAction<string>>;
	activeFilter: AdminUsersFilterSnapshot['activeFilter'];
	setActiveFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['activeFilter']>
	>;
	trustedFilter: AdminUsersFilterSnapshot['trustedFilter'];
	setTrustedFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['trustedFilter']>
	>;
	verifiedFilter: AdminUsersFilterSnapshot['verifiedFilter'];
	setVerifiedFilter: React.Dispatch<
		React.SetStateAction<AdminUsersFilterSnapshot['verifiedFilter']>
	>;
	onlineOnly: boolean;
	setOnlineOnly: React.Dispatch<React.SetStateAction<boolean>>;
	anomalyOnly: boolean;
	setAnomalyOnly: React.Dispatch<React.SetStateAction<boolean>>;
	ssoBrowserOnly: boolean;
	setSsoBrowserOnly: React.Dispatch<React.SetStateAction<boolean>>;
	ssoMobileOnly: boolean;
	ssoDesktopOnly: boolean;
	setSsoMobileOnly: React.Dispatch<React.SetStateAction<boolean>>;
	setSsoDesktopOnly: React.Dispatch<React.SetStateAction<boolean>>;
	mismatchOnly: boolean;
	setMismatchOnly: React.Dispatch<React.SetStateAction<boolean>>;
	sortValue: string;
	setSortValue: React.Dispatch<React.SetStateAction<string>>;
	channelsCompact: boolean;
	setChannelsCompact: React.Dispatch<React.SetStateAction<boolean>>;
	tableColumns: AdminUsersTableColumns;
	setTableColumns: React.Dispatch<React.SetStateAction<AdminUsersTableColumns>>;
	autoRefresh: boolean;
	setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>;
	groups: AccessGroupResponse[] | undefined;
	groupsLoading: boolean;
	hasActiveFilters: boolean;
	clearFilters: () => void;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	filtersExpanded: boolean;
	onFiltersExpandedChange: (open: boolean) => void;
};

export function buildAdminUsersCatalogFiltersController(
	input: BuildAdminUsersCatalogFiltersControllerInput
): AdminUsersCatalogFiltersController {
	return {
		search: input.search,
		setSearch: input.setSearch,
		searchInputRef: input.searchInputRef,
		roleFilter: input.roleFilter,
		setRoleFilter: input.setRoleFilter,
		groupFilter: input.groupFilter,
		setGroupFilter: input.setGroupFilter,
		activeFilter: input.activeFilter,
		setActiveFilter: input.setActiveFilter,
		trustedFilter: input.trustedFilter,
		setTrustedFilter: input.setTrustedFilter,
		verifiedFilter: input.verifiedFilter,
		setVerifiedFilter: input.setVerifiedFilter,
		onlineOnly: input.onlineOnly,
		setOnlineOnly: input.setOnlineOnly,
		anomalyOnly: input.anomalyOnly,
		setAnomalyOnly: input.setAnomalyOnly,
		ssoBrowserOnly: input.ssoBrowserOnly,
		setSsoBrowserOnly: input.setSsoBrowserOnly,
		ssoMobileOnly: input.ssoMobileOnly,
		ssoDesktopOnly: input.ssoDesktopOnly,
		setSsoMobileOnly: input.setSsoMobileOnly,
		setSsoDesktopOnly: input.setSsoDesktopOnly,
		mismatchOnly: input.mismatchOnly,
		setMismatchOnly: input.setMismatchOnly,
		sortValue: input.sortValue,
		setSortValue: input.setSortValue,
		channelsCompact: input.channelsCompact,
		setChannelsCompact: input.setChannelsCompact,
		tableColumns: input.tableColumns,
		setTableColumns: input.setTableColumns,
		autoRefresh: input.autoRefresh,
		setAutoRefresh: input.setAutoRefresh,
		groups: input.groups,
		groupsLoading: input.groupsLoading,
		hasActiveFilters: input.hasActiveFilters,
		clearFilters: input.clearFilters,
		setPage: input.setPage,
		filtersExpanded: input.filtersExpanded,
		onFiltersExpandedChange: input.onFiltersExpandedChange,
	};
}
