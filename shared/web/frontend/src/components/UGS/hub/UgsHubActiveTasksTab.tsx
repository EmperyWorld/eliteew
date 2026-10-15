/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub «Активные» tab — full list of in-flight generation tasks.
 *
 * Related:
 * - ugsHubSharedUi.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import type { UgsHubRenderTaskList } from './types';
import { UgsHubSectionHeading } from './ugsHubSharedUi';

export interface UgsHubActiveTasksTabProps {
	renderTaskList: UgsHubRenderTaskList;
	sortedActiveFilteredTasks: UGSTask[];
	filteredActiveTasksCount: number;
	onManualRefresh: () => void;
}

export const UgsHubActiveTasksTab: FC<UgsHubActiveTasksTabProps> = ({
	renderTaskList,
	sortedActiveFilteredTasks,
	filteredActiveTasksCount,
	onManualRefresh,
}) => {
	const { t } = useTranslation('ugsHub');

	return (
		<div className="min-w-0 space-y-3" data-ugs-hub-guide="task-list">
			<UgsHubSectionHeading
				eyebrow={t('panels.active.eyebrow')}
				title={t('panels.active.title')}
				count={filteredActiveTasksCount}
			/>
			{renderTaskList(sortedActiveFilteredTasks, {
				emptyTitle: t('panels.active.emptyTitle'),
				emptyDescription: t('panels.active.emptyDescription'),
				emptyActionLabel: t('empty.defaultAction'),
				onEmptyAction: onManualRefresh,
			})}
		</div>
	);
};
