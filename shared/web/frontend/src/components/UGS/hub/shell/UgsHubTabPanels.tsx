/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tab body panels for UGS Hub (overview, active, history, results, admin, workflows).
 *
 * Invariants:
 * - Admin-only tabs render only when `showUgsAdminLink` is true.
 * - Overview is launch + work preview only — no operator queue-ops panel.
 *
 * Related:
 * - components/UGSHub.tsx, hooks/ugsHub/useUgsHubController.ts
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../../hooks/api/useUgsDashboard';
import type { UgsHubController } from '../../../../hooks/ugsHub/useUgsHubController';
import type { NavigationHandler } from '../../../../types/navigation';
import UGSWorkflowsTab from '../../UGSWorkflowsTab';
import { UgsHubActiveTasksTab } from '../UgsHubActiveTasksTab';
import { UgsHubAdminHistoryTab } from '../UgsHubAdminHistoryTab';
import { UgsHubOverviewTab } from '../UgsHubOverviewTab';
import { UgsHubPaginatedTasksTab } from '../UgsHubPaginatedTasksTab';
import type { UgsHubActiveTab } from '../types';
import { UGS_HUB_ITEMS_PER_PAGE } from '../ugsHubUi';

type RenderTaskList = UgsHubController['renderTaskList'];

export interface UgsHubTabPanelsProps {
	activeTab: UgsHubActiveTab;
	showUgsAdminLink: boolean;
	onNavigate?: NavigationHandler;
	onOpenTariffs: () => void;
	onManualRefresh: () => void;
	currentPage: number;
	onPageChange: (page: number) => void;
	renderTaskList: RenderTaskList;
	filterState: UgsHubController['filterState'];
	adminFilterState: UgsHubController['adminFilterState'];
	adminHistoryQuery: Pick<UseQueryResult<UGSTask[]>, 'isLoading' | 'isError'>;
	toast: UgsHubController['toast'];
	ugsClient: UgsHubController['ugsClient'];
}

export function UgsHubTabPanels({
	activeTab,
	showUgsAdminLink,
	onNavigate,
	onOpenTariffs,
	onManualRefresh,
	currentPage,
	onPageChange,
	renderTaskList,
	filterState,
	adminFilterState,
	adminHistoryQuery,
	toast,
	ugsClient,
}: UgsHubTabPanelsProps) {
	const { t } = useTranslation('ugsHub');
	const {
		sortedActiveFilteredTasks,
		sortedFilteredTasks,
		sortedFailedTasks,
		filteredActiveTasks,
		sortedHistoryTasks,
		sortedCompletedTasks,
	} = filterState;

	return (
		<section className="space-y-8">
			{activeTab === 'overview' ? (
				<UgsHubOverviewTab
					renderTaskList={renderTaskList}
					sortedActiveFilteredTasks={sortedActiveFilteredTasks}
					sortedFilteredTasks={sortedFilteredTasks}
					sortedFailedTasks={sortedFailedTasks}
					filteredActiveTasks={filteredActiveTasks}
					onOpenTariffs={onOpenTariffs}
					onManualRefresh={onManualRefresh}
				/>
			) : null}

			{activeTab === 'active' ? (
				<UgsHubActiveTasksTab
					renderTaskList={renderTaskList}
					sortedActiveFilteredTasks={sortedActiveFilteredTasks}
					filteredActiveTasksCount={filteredActiveTasks.length}
					onManualRefresh={onManualRefresh}
				/>
			) : null}

			{activeTab === 'history' ? (
				<UgsHubPaginatedTasksTab
					sectionLabel={t('panels.history.eyebrow')}
					title={t('panels.history.title')}
					taskCount={sortedHistoryTasks.length}
					tasks={sortedHistoryTasks}
					page={currentPage}
					itemsPerPage={UGS_HUB_ITEMS_PER_PAGE}
					onPageChange={onPageChange}
					renderTaskList={renderTaskList}
					listConfig={{
						emptyTitle: t('panels.history.emptyTitle'),
						emptyDescription: t('panels.history.emptyDescription'),
						showViewAction: true,
						highlightErrors: true,
					}}
				/>
			) : null}

			{activeTab === 'results' ? (
				<UgsHubPaginatedTasksTab
					sectionLabel={t('panels.results.eyebrow')}
					title={t('panels.results.title')}
					taskCount={sortedCompletedTasks.length}
					tasks={sortedCompletedTasks}
					page={currentPage}
					itemsPerPage={UGS_HUB_ITEMS_PER_PAGE}
					onPageChange={onPageChange}
					renderTaskList={renderTaskList}
					listConfig={{
						emptyTitle: t('panels.results.emptyTitle'),
						emptyDescription: t('panels.results.emptyDescription'),
						showViewAction: true,
						showDownloadAction: true,
					}}
				/>
			) : null}

			{activeTab === 'admin_history' && showUgsAdminLink ? (
				<UgsHubAdminHistoryTab
					taskCount={adminFilterState.filteredTasks.length}
					isLoading={adminHistoryQuery.isLoading}
					isError={adminHistoryQuery.isError}
					tasks={adminFilterState.sortedFilteredTasks}
					renderTaskList={renderTaskList}
					onManualRefresh={onManualRefresh}
				/>
			) : null}

			{activeTab === 'workflows' ? (
				<UGSWorkflowsTab
					onNavigate={onNavigate}
					ugsClient={ugsClient}
					toast={toast}
				/>
			) : null}
		</section>
	);
}
