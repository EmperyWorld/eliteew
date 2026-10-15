/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public types for admin Users hub filters hook (directory key, query params, facade).
 *
 * Invariants:
 * - Shape stays stable for `useAdminUsersHubController` / view consumers.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 */

import type * as React from 'react';
import type { AccessGroupResponse } from '../../Desktop/services/desktopAdminApi';
import type {
	AdminDirectorySortBy,
	AdminDirectorySortDir,
} from '../adminDirectorySort';
import type {
	AdminUsersFilterSnapshot,
	AdminUsersNamedPreset,
} from '../adminUsersFilterPresets';
import type { AdminUsersFilterChipDef } from '../adminUsersActiveFilterChips';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';
import type { AdminUsersCatalogFiltersController } from './adminUsersCatalogFiltersTypes';

export type AdminUsersDirectoryFilterKey = {
	search: string;
	role: string;
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
};

export type AdminUsersDirectoryQueryParams = {
	search: string | undefined;
	role: string | undefined;
	is_active: boolean | undefined;
	is_trusted: boolean | undefined;
	is_verified: boolean | undefined;
	online_only: boolean;
	app_access_group_id: string | undefined;
	presence_anomaly_only: boolean;
	sso_browser_active_only: boolean;
	sso_mobile_active_only: boolean;
	sso_desktop_active_only: boolean;
	channel_mismatch_only: boolean;
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
};

export type AdminUsersHubFilters = {
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	debouncedSearch: string;
	currentFilterSnapshot: AdminUsersFilterSnapshot;
	directoryQueryParams: AdminUsersDirectoryQueryParams;
	directoryFilterKey: AdminUsersDirectoryFilterKey;
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
	toggleColumnSort: (key: AdminDirectorySortBy) => void;
	onlineOnly: boolean;
	anomalyOnly: boolean;
	mismatchOnly: boolean;
	channelsCompact: boolean;
	tableColumns: AdminUsersTableColumns;
	tableColSpan: number;
	autoRefresh: boolean;
	hasActiveFilters: boolean;
	clearFilters: () => void;
	activeFilterChipDefs: AdminUsersFilterChipDef[];
	handleClearFilterChip: (chipId: string) => void;
	filtersCtrl: AdminUsersCatalogFiltersController;
	namedPresets: AdminUsersNamedPreset[];
	selectedPresetId: string;
	handlePresetSelect: (id: string) => void;
	handleDeleteNamedPreset: () => void;
	handleSaveNamedPreset: () => void;
	applySummaryOnlineFilter: () => void;
	applySummaryAnomalyFilter: () => void;
	applySummarySsoBrowserFilter: () => void;
	applySummarySsoMobileFilter: () => void;
	applySummarySsoDesktopFilter: () => void;
	applySummaryMismatchFilter: () => void;
	applyFilterSnapshot: (raw: AdminUsersFilterSnapshot) => void;
	setSearch: React.Dispatch<React.SetStateAction<string>>;
};

export type UseAdminUsersHubFiltersOptions = {
	initialFilters: AdminUsersFilterSnapshot;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	groupsData: AccessGroupResponse[] | undefined;
	groupsLoading: boolean;
};
