/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Task filters + bulk toolbar block for UGS Hub (hidden on workflows tab).
 *
 * Related:
 * - ugsHubSharedUi.tsx (UgsHubFiltersPanel)
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { UgsHubController } from '../../../../hooks/ugsHub/useUgsHubController';
import UGSTaskFilters from '../../UGSTaskFilters';
import { buildUgsHubCategoryLabelMap } from '../ugsHubTaskListMeta';
import { UgsHubFiltersPanel } from '../ugsHubSharedUi';
import { UGS_HUB_STATUS_FILTER_VALUES } from '../ugsHubUi';
import { UgsHubTasksToolbar } from './UgsHubTasksToolbar';

export interface UgsHubFiltersSectionProps {
	searchQuery: string;
	onSearchChange: (value: string) => void;
	statusFilter: string;
	onStatusFilterChange: (value: string) => void;
	categoryFilter: string;
	onCategoryFilterChange: (value: string) => void;
	providerFilter: string;
	onProviderFilterChange: (value: string) => void;
	filtersApplied: boolean;
	onResetFilters: () => void;
	filterState: UgsHubController['filterState'];
	tasksCount: number;
	selectedCount: number;
	bulkActionMode: boolean;
	onToggleBulkMode: () => void;
	onClearSelection: () => void;
	taskActions: UgsHubController['taskActions'];
}

export function UgsHubFiltersSection({
	searchQuery,
	onSearchChange,
	statusFilter,
	onStatusFilterChange,
	categoryFilter,
	onCategoryFilterChange,
	providerFilter,
	onProviderFilterChange,
	filtersApplied,
	onResetFilters,
	filterState,
	tasksCount,
	selectedCount,
	bulkActionMode,
	onToggleBulkMode,
	onClearSelection,
	taskActions,
}: UgsHubFiltersSectionProps) {
	const { t } = useTranslation('ugsHub');
	const categoryLabelMap = useMemo(() => buildUgsHubCategoryLabelMap(t), [t]);
	const statusOptions = useMemo(
		() =>
			UGS_HUB_STATUS_FILTER_VALUES.map((value) => ({
				value,
				label: t(`statusFilter.${value}`),
			})),
		[t]
	);

	return (
		<div data-ugs-hub-guide="filters">
			<UgsHubFiltersPanel>
				<UGSTaskFilters
					searchQuery={searchQuery}
					onSearchChange={onSearchChange}
					statusFilter={statusFilter}
					onStatusFilterChange={onStatusFilterChange}
					statusOptions={statusOptions}
					categoryFilter={categoryFilter}
					onCategoryFilterChange={onCategoryFilterChange}
					providerFilter={providerFilter}
					onProviderFilterChange={onProviderFilterChange}
					filtersApplied={filtersApplied}
					onResetFilters={onResetFilters}
					availableCategories={filterState.availableCategories}
					availableProviders={filterState.availableProviders}
					categoryLabelMap={categoryLabelMap}
					providerLabelMap={filterState.providerLabelMap}
					embedded
				/>
				<UgsHubTasksToolbar
					filteredCount={filterState.filteredTasks.length}
					totalCount={tasksCount}
					selectedCount={selectedCount}
					bulkActionMode={bulkActionMode}
					onExportJson={() => taskActions.exportTasks('json')}
					onExportCsv={() => taskActions.exportTasks('csv')}
					onBulkRetry={() => void taskActions.handleBulkRetry()}
					onBulkDelete={taskActions.handleBulkDelete}
					onClearSelection={onClearSelection}
					onToggleBulkMode={onToggleBulkMode}
				/>
			</UgsHubFiltersPanel>
		</div>
	);
}
