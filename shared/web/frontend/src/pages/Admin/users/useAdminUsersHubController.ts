/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin composer for admin Users hub: wires filter, directory, bulk, and shell subhooks.
 *
 * Invariants:
 * - Public `AdminUsersHubController` shape is stable for `AdminUsersHubSection`.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 * - `pages/Admin/users/useAdminUsersHubDirectory.ts`
 * - `pages/Admin/users/useAdminUsersHubBulk.ts`
 * - `pages/Admin/users/useAdminUsersHubShell.ts`
 */

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
	getAccessGroups,
	type AccessGroupResponse,
} from '../../Desktop/services/desktopAdminApi';
import { adminApi } from '../../../services/admin/api';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import {
	type AdminDirectorySortBy,
	type AdminDirectorySortDir,
} from '../adminDirectorySort';
import { type AdminUserDetailTab } from '../adminUsersDetailTab';
import { type AdminUsersNamedPreset } from '../adminUsersFilterPresets';
import { type AdminUsersHubView } from '../adminUsersHubView';
import type { AdminUsersFilterChipDef } from '../adminUsersActiveFilterChips';
import type { AdminUsersCatalogFiltersController } from './adminUsersCatalogFiltersTypes';
import { readInitialAdminUsersHubState } from './adminUsersHubInitialState';
import { useAdminUsersHubBulk } from './useAdminUsersHubBulk';
import { useAdminUsersHubDirectory } from './useAdminUsersHubDirectory';
import { useAdminUsersHubFilters } from './useAdminUsersHubFilters';
import { useAdminUsersHubShell } from './useAdminUsersHubShell';
import type { AdminUsersTableColumns } from '../adminUsersTableColumns';

export type AdminUsersHubController = {
	t: TFunction<'desktopUi'>;
	hubView: AdminUsersHubView;
	setHubViewAndSync: (next: AdminUsersHubView) => void;
	handleOpenUserFromPresence: (userId: string) => void;
	panelUser: AdminDirectoryUserRow | null;
	closeUserPanel: () => void;
	invalidateDirectory: () => void;
	panelDetailTab: AdminUserDetailTab;
	handleDetailTabChange: (tab: AdminUserDetailTab) => void;
	bulkOpen: boolean;
	closeBulkModal: () => void;
	bulkGroups: AccessGroupResponse[];
	handleBulkApply: (groupId: string | null) => Promise<void>;
	bulkBusy: boolean;
	bulkProgress: { done: number; total: number } | null;
	payload: Awaited<ReturnType<typeof adminApi.getUsersDirectory>> | null;
	onlineOnPage: number;
	mismatchOnPage: number;
	mismatchOnly: boolean;
	selectedUserIds: string[];
	applySummaryOnlineFilter: () => void;
	applySummaryAnomalyFilter: () => void;
	applySummarySsoBrowserFilter: () => void;
	applySummarySsoMobileFilter: () => void;
	applySummarySsoDesktopFilter: () => void;
	applySummaryMismatchFilter: () => void;
	namedPresets: AdminUsersNamedPreset[];
	selectedPresetId: string;
	handlePresetSelect: (id: string) => void;
	handleDeleteNamedPreset: () => void;
	handleSaveNamedPreset: () => void;
	handleCopyShareLink: () => void;
	refetchDirectory: () => void;
	loading: boolean;
	activeFilterChipDefs: AdminUsersFilterChipDef[];
	handleClearFilterChip: (chipId: string) => void;
	hasActiveFilters: boolean;
	clearFilters: () => void;
	filtersCtrl: AdminUsersCatalogFiltersController;
	selectAllBusy: boolean;
	handleSelectAllMatchingFilter: () => Promise<void>;
	handleExportAllMatchingCsv: () => Promise<void>;
	openBulkModal: () => void;
	handleExportSelectedCsv: () => void;
	redisFilterHintKeys: string[];
	onlineOnly: boolean;
	anomalyOnly: boolean;
	error: string | null;
	mobileCatalog: boolean;
	tableList: AdminDirectoryUserRow[];
	toggleOne: (id: string) => void;
	openUserPanel: (u: AdminDirectoryUserRow) => void;
	page: number;
	totalPages: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	tableColumns: AdminUsersTableColumns;
	channelsCompact: boolean;
	tableColSpan: number;
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
	toggleColumnSort: (key: AdminDirectorySortBy) => void;
	toggleAll: () => void;
};

export function useAdminUsersHubController(): AdminUsersHubController {
	const { t } = useTranslation('desktopUi');
	const initialHub = React.useMemo(readInitialAdminUsersHubState, []);
	const [page, setPage] = React.useState(initialHub.page);

	const groupsQuery = useQuery({
		queryKey: ['desktop', 'admin', 'access-groups'],
		queryFn: getAccessGroups,
		staleTime: 60_000,
	});

	const filters = useAdminUsersHubFilters({
		initialFilters: initialHub.filters,
		setPage,
		groupsData: groupsQuery.data,
		groupsLoading: groupsQuery.isLoading,
	});

	const shell = useAdminUsersHubShell({
		initialView: initialHub.view,
		initialPanelDetailTab: initialHub.panelDetailTab,
		page,
		setPage,
		currentFilterSnapshot: filters.currentFilterSnapshot,
		debouncedSearch: filters.debouncedSearch,
		setSearch: filters.setSearch,
		searchInputRef: filters.searchInputRef,
	});

	const directory = useAdminUsersHubDirectory({
		hubView: shell.hubView,
		page,
		setPage,
		directoryQueryParams: filters.directoryQueryParams,
		directoryFilterKey: filters.directoryFilterKey,
		autoRefresh: filters.autoRefresh,
		panelUser: shell.panelUser,
		setPanelUser: shell.setPanelUser,
		onlineOnly: filters.onlineOnly,
		anomalyOnly: filters.anomalyOnly,
		mismatchOnly: filters.mismatchOnly,
	});

	const bulk = useAdminUsersHubBulk({
		t,
		selectedUserIds: directory.selectedUserIds,
		setSelectedUserIds: directory.setSelectedUserIds,
		payload: directory.payload,
		directoryQueryParams: filters.directoryQueryParams,
		tableColumns: filters.tableColumns,
		list: directory.tableList,
		invalidateDirectory: directory.invalidateDirectory,
	});

	return {
		t,
		hubView: shell.hubView,
		setHubViewAndSync: shell.setHubViewAndSync,
		handleOpenUserFromPresence: shell.handleOpenUserFromPresence,
		panelUser: shell.panelUser,
		closeUserPanel: shell.closeUserPanel,
		invalidateDirectory: directory.invalidateDirectory,
		panelDetailTab: shell.panelDetailTab,
		handleDetailTabChange: shell.handleDetailTabChange,
		bulkOpen: bulk.bulkOpen,
		closeBulkModal: bulk.closeBulkModal,
		bulkGroups: groupsQuery.data ?? [],
		handleBulkApply: bulk.handleBulkApply,
		bulkBusy: bulk.bulkBusy,
		bulkProgress: bulk.bulkProgress,
		payload: directory.payload,
		onlineOnPage: directory.onlineOnPage,
		mismatchOnPage: directory.mismatchOnPage,
		mismatchOnly: filters.mismatchOnly,
		selectedUserIds: directory.selectedUserIds,
		applySummaryOnlineFilter: filters.applySummaryOnlineFilter,
		applySummaryAnomalyFilter: filters.applySummaryAnomalyFilter,
		applySummarySsoBrowserFilter: filters.applySummarySsoBrowserFilter,
		applySummarySsoMobileFilter: filters.applySummarySsoMobileFilter,
		applySummarySsoDesktopFilter: filters.applySummarySsoDesktopFilter,
		applySummaryMismatchFilter: filters.applySummaryMismatchFilter,
		namedPresets: filters.namedPresets,
		selectedPresetId: filters.selectedPresetId,
		handlePresetSelect: filters.handlePresetSelect,
		handleDeleteNamedPreset: filters.handleDeleteNamedPreset,
		handleSaveNamedPreset: filters.handleSaveNamedPreset,
		handleCopyShareLink: shell.handleCopyShareLink,
		refetchDirectory: directory.refetchDirectory,
		loading: directory.loading,
		activeFilterChipDefs: filters.activeFilterChipDefs,
		handleClearFilterChip: filters.handleClearFilterChip,
		hasActiveFilters: filters.hasActiveFilters,
		clearFilters: filters.clearFilters,
		filtersCtrl: filters.filtersCtrl,
		selectAllBusy: bulk.selectAllBusy,
		handleSelectAllMatchingFilter: bulk.handleSelectAllMatchingFilter,
		handleExportAllMatchingCsv: bulk.handleExportAllMatchingCsv,
		openBulkModal: bulk.openBulkModal,
		handleExportSelectedCsv: bulk.handleExportSelectedCsv,
		redisFilterHintKeys: directory.redisFilterHintKeys,
		onlineOnly: filters.onlineOnly,
		anomalyOnly: filters.anomalyOnly,
		error: directory.error,
		mobileCatalog: directory.mobileCatalog,
		tableList: directory.tableList,
		toggleOne: directory.toggleOne,
		openUserPanel: shell.openUserPanel,
		page,
		totalPages: directory.totalPages,
		setPage,
		tableColumns: filters.tableColumns,
		channelsCompact: filters.channelsCompact,
		tableColSpan: filters.tableColSpan,
		sort_by: filters.sort_by,
		sort_dir: filters.sort_dir,
		toggleColumnSort: filters.toggleColumnSort,
		toggleAll: directory.toggleAll,
	};
}
