/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Props contract for admin Users catalog filters panel (state + setters from hub).
 */

import type { RefObject } from 'react';
import type { AccessGroupResponse } from '../../Desktop/services/desktopAdminApi';
import type { AdminUsersTriFilter } from '../adminUsersFilterPresets';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';

export type AdminUsersCatalogFiltersController = {
	search: string;
	setSearch: (value: string) => void;
	searchInputRef: RefObject<HTMLInputElement | null>;
	roleFilter: string;
	setRoleFilter: (value: string) => void;
	groupFilter: string;
	setGroupFilter: (value: string) => void;
	activeFilter: AdminUsersTriFilter;
	setActiveFilter: (value: AdminUsersTriFilter) => void;
	trustedFilter: AdminUsersTriFilter;
	setTrustedFilter: (value: AdminUsersTriFilter) => void;
	verifiedFilter: AdminUsersTriFilter;
	setVerifiedFilter: (value: AdminUsersTriFilter) => void;
	onlineOnly: boolean;
	setOnlineOnly: (value: boolean) => void;
	anomalyOnly: boolean;
	setAnomalyOnly: (value: boolean) => void;
	ssoBrowserOnly: boolean;
	setSsoBrowserOnly: (value: boolean) => void;
	ssoMobileOnly: boolean;
	setSsoMobileOnly: (value: boolean) => void;
	ssoDesktopOnly: boolean;
	setSsoDesktopOnly: (value: boolean) => void;
	mismatchOnly: boolean;
	setMismatchOnly: (value: boolean | ((prev: boolean) => boolean)) => void;
	sortValue: string;
	setSortValue: (value: string) => void;
	channelsCompact: boolean;
	setChannelsCompact: (value: boolean) => void;
	tableColumns: AdminUsersTableColumns;
	setTableColumns: (value: AdminUsersTableColumns) => void;
	autoRefresh: boolean;
	setAutoRefresh: (value: boolean) => void;
	groups: AccessGroupResponse[] | undefined;
	groupsLoading: boolean;
	hasActiveFilters: boolean;
	clearFilters: () => void;
	setPage: (page: number) => void;
	filtersExpanded: boolean;
	onFiltersExpandedChange: (open: boolean) => void;
};
