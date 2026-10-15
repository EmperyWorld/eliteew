/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose Users hub filters facade: directory state, prefs, presets, chips, summary.
 *
 * Invariants:
 * - Public `AdminUsersHubFilters` shape stays stable for the hub composer/view.
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubController.ts`
 * - `pages/Admin/users/useAdminUsersDirectoryFilterState.ts`
 * - `pages/Admin/users/useAdminUsersHubTablePrefs.ts`
 * - `pages/Admin/users/useAdminUsersHubNamedPresets.ts`
 */

import * as React from 'react';
import { DEFAULT_ADMIN_USERS_FILTERS } from '../adminUsersFilterPresets';
import {
	buildAdminUsersFilterChipDefs,
	clearAdminUsersFilterChip,
} from '../adminUsersActiveFilterChips';
import {
	loadAdminUsersFiltersExpanded,
	saveAdminUsersFiltersExpanded,
} from '../adminUsersFilterPanelPrefs';
import { buildAdminUsersCatalogFiltersController } from './buildAdminUsersCatalogFiltersController';
import type {
	AdminUsersHubFilters,
	UseAdminUsersHubFiltersOptions,
} from './adminUsersHubFiltersTypes';
import {
	applySummaryAnomalyFilter as applySummaryAnomalyFilterPure,
	applySummaryMismatchFilter as applySummaryMismatchFilterPure,
	applySummaryOnlineFilter as applySummaryOnlineFilterPure,
	applySummarySsoBrowserFilter as applySummarySsoBrowserFilterPure,
	applySummarySsoDesktopFilter as applySummarySsoDesktopFilterPure,
	applySummarySsoMobileFilter as applySummarySsoMobileFilterPure,
} from './adminUsersSummaryFilterApply';
import { useAdminUsersDirectoryFilterState } from './useAdminUsersDirectoryFilterState';
import { useAdminUsersHubNamedPresets } from './useAdminUsersHubNamedPresets';
import { useAdminUsersHubTablePrefs } from './useAdminUsersHubTablePrefs';

export type {
	AdminUsersDirectoryFilterKey,
	AdminUsersDirectoryQueryParams,
	AdminUsersHubFilters,
} from './adminUsersHubFiltersTypes';

export function useAdminUsersHubFilters(
	options: UseAdminUsersHubFiltersOptions
): AdminUsersHubFilters {
	const { initialFilters, setPage, groupsData, groupsLoading } = options;

	const dir = useAdminUsersDirectoryFilterState({ initialFilters, setPage });
	const [filtersExpanded, setFiltersExpanded] = React.useState(
		loadAdminUsersFiltersExpanded
	);
	const {
		channelsCompact,
		setChannelsCompact,
		tableColumns,
		setTableColumns,
		tableColSpan,
		autoRefresh,
		setAutoRefresh,
	} = useAdminUsersHubTablePrefs();

	const onFiltersExpandedChange = React.useCallback((open: boolean) => {
		setFiltersExpanded(open);
		saveAdminUsersFiltersExpanded(open);
	}, []);

	const {
		namedPresets,
		selectedPresetId,
		handlePresetSelect,
		handleDeleteNamedPreset,
		handleSaveNamedPreset,
		clearSelectedPresetId,
	} = useAdminUsersHubNamedPresets({
		currentFilterSnapshot: dir.currentFilterSnapshot,
		debouncedSearch: dir.debouncedSearch,
		applyFilterSnapshot: dir.applyFilterSnapshot,
	});

	const clearFilters = React.useCallback((): void => {
		dir.applyFilterSnapshot(DEFAULT_ADMIN_USERS_FILTERS);
		clearSelectedPresetId();
		setPage(1);
	}, [dir.applyFilterSnapshot, clearSelectedPresetId, setPage]);

	const activeFilterChipDefs = React.useMemo(
		() => buildAdminUsersFilterChipDefs(dir.currentFilterSnapshot),
		[dir.currentFilterSnapshot]
	);

	const handleClearFilterChip = React.useCallback(
		(chipId: string) => {
			dir.applyFilterSnapshot(
				clearAdminUsersFilterChip(chipId, dir.currentFilterSnapshot)
			);
			setPage(1);
		},
		[dir.applyFilterSnapshot, dir.currentFilterSnapshot, setPage]
	);

	const summarySetters = React.useMemo(
		() => ({
			setOnlineOnly: dir.setOnlineOnly,
			setAnomalyOnly: dir.setAnomalyOnly,
			setSsoBrowserOnly: dir.setSsoBrowserOnly,
			setSsoMobileOnly: dir.setSsoMobileOnly,
			setSsoDesktopOnly: dir.setSsoDesktopOnly,
			setMismatchOnly: dir.setMismatchOnly,
			setPage,
		}),
		[
			dir.setOnlineOnly,
			dir.setAnomalyOnly,
			dir.setSsoBrowserOnly,
			dir.setSsoMobileOnly,
			dir.setSsoDesktopOnly,
			dir.setMismatchOnly,
			setPage,
		]
	);

	const applySummaryOnlineFilter = React.useCallback(() => {
		applySummaryOnlineFilterPure(summarySetters);
	}, [summarySetters]);
	const applySummaryAnomalyFilter = React.useCallback(() => {
		applySummaryAnomalyFilterPure(summarySetters);
	}, [summarySetters]);
	const applySummarySsoBrowserFilter = React.useCallback(() => {
		applySummarySsoBrowserFilterPure(summarySetters);
	}, [summarySetters]);
	const applySummarySsoMobileFilter = React.useCallback(() => {
		applySummarySsoMobileFilterPure(summarySetters);
	}, [summarySetters]);
	const applySummarySsoDesktopFilter = React.useCallback(() => {
		applySummarySsoDesktopFilterPure(summarySetters);
	}, [summarySetters]);
	const applySummaryMismatchFilter = React.useCallback(() => {
		applySummaryMismatchFilterPure(summarySetters);
	}, [summarySetters]);

	const filtersCtrl = React.useMemo(
		() =>
			buildAdminUsersCatalogFiltersController({
				search: dir.search,
				setSearch: dir.setSearch,
				searchInputRef: dir.searchInputRef,
				roleFilter: dir.roleFilter,
				setRoleFilter: dir.setRoleFilter,
				groupFilter: dir.groupFilter,
				setGroupFilter: dir.setGroupFilter,
				activeFilter: dir.activeFilter,
				setActiveFilter: dir.setActiveFilter,
				trustedFilter: dir.trustedFilter,
				setTrustedFilter: dir.setTrustedFilter,
				verifiedFilter: dir.verifiedFilter,
				setVerifiedFilter: dir.setVerifiedFilter,
				onlineOnly: dir.onlineOnly,
				setOnlineOnly: dir.setOnlineOnly,
				anomalyOnly: dir.anomalyOnly,
				setAnomalyOnly: dir.setAnomalyOnly,
				ssoBrowserOnly: dir.ssoBrowserOnly,
				setSsoBrowserOnly: dir.setSsoBrowserOnly,
				ssoMobileOnly: dir.ssoMobileOnly,
				setSsoMobileOnly: dir.setSsoMobileOnly,
				ssoDesktopOnly: dir.ssoDesktopOnly,
				setSsoDesktopOnly: dir.setSsoDesktopOnly,
				mismatchOnly: dir.mismatchOnly,
				setMismatchOnly: dir.setMismatchOnly,
				sortValue: dir.sortValue,
				setSortValue: dir.setSortValue,
				channelsCompact,
				setChannelsCompact,
				tableColumns,
				setTableColumns,
				autoRefresh,
				setAutoRefresh,
				groups: groupsData,
				groupsLoading,
				hasActiveFilters: dir.hasActiveFilters,
				clearFilters,
				setPage,
				filtersExpanded,
				onFiltersExpandedChange,
			}),
		[
			dir.search,
			dir.setSearch,
			dir.searchInputRef,
			dir.roleFilter,
			dir.setRoleFilter,
			dir.groupFilter,
			dir.setGroupFilter,
			dir.activeFilter,
			dir.setActiveFilter,
			dir.trustedFilter,
			dir.setTrustedFilter,
			dir.verifiedFilter,
			dir.setVerifiedFilter,
			dir.onlineOnly,
			dir.setOnlineOnly,
			dir.anomalyOnly,
			dir.setAnomalyOnly,
			dir.ssoBrowserOnly,
			dir.setSsoBrowserOnly,
			dir.ssoMobileOnly,
			dir.setSsoMobileOnly,
			dir.ssoDesktopOnly,
			dir.setSsoDesktopOnly,
			dir.mismatchOnly,
			dir.setMismatchOnly,
			dir.sortValue,
			dir.setSortValue,
			channelsCompact,
			setChannelsCompact,
			tableColumns,
			setTableColumns,
			autoRefresh,
			setAutoRefresh,
			groupsData,
			groupsLoading,
			dir.hasActiveFilters,
			clearFilters,
			setPage,
			filtersExpanded,
			onFiltersExpandedChange,
		]
	);

	return {
		searchInputRef: dir.searchInputRef,
		debouncedSearch: dir.debouncedSearch,
		currentFilterSnapshot: dir.currentFilterSnapshot,
		directoryQueryParams: dir.directoryQueryParams,
		directoryFilterKey: dir.directoryFilterKey,
		sort_by: dir.sort_by,
		sort_dir: dir.sort_dir,
		toggleColumnSort: dir.toggleColumnSort,
		onlineOnly: dir.onlineOnly,
		anomalyOnly: dir.anomalyOnly,
		mismatchOnly: dir.mismatchOnly,
		channelsCompact,
		tableColumns,
		tableColSpan,
		autoRefresh,
		hasActiveFilters: dir.hasActiveFilters,
		clearFilters,
		activeFilterChipDefs,
		handleClearFilterChip,
		filtersCtrl,
		namedPresets,
		selectedPresetId,
		handlePresetSelect,
		handleDeleteNamedPreset,
		handleSaveNamedPreset,
		applySummaryOnlineFilter,
		applySummaryAnomalyFilter,
		applySummarySsoBrowserFilter,
		applySummarySsoMobileFilter,
		applySummarySsoDesktopFilter,
		applySummaryMismatchFilter,
		applyFilterSnapshot: dir.applyFilterSnapshot,
		setSearch: dir.setSearch,
	};
}
