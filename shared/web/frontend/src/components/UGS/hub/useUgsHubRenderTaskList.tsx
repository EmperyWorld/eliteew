/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Returns the UGS Hub `renderTaskList` callback backed by `UgsHubTaskList`.
 *
 * Related:
 * - components/UGSHub.tsx
 * - components/UGS/hub/UgsHubTaskList.tsx
 */

import { useCallback } from 'react';
import type { ReactNode } from 'react';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { UgsHubTaskList, type UgsHubTaskListProps } from './UgsHubTaskList';
import type { UgsHubRenderTaskList, UgsHubTaskListConfig } from './types';

export type UseUgsHubRenderTaskListParams = Omit<
	UgsHubTaskListProps,
	'tasks' | 'config'
>;

export function useUgsHubRenderTaskList(
	params: UseUgsHubRenderTaskListParams
): UgsHubRenderTaskList {
	const {
		categoryByType,
		providerByType,
		providerDisplayByType,
		displayNameByType,
		bulkActionMode,
		selectedTasks,
		showUgsAdminLink,
		onToggleTaskSelection,
		onViewResult,
		onDownloadResult,
		onCancelTask,
		onOpenDocEditor,
		getContentIdFromResult,
		getTaskIcon,
		getStatusColor,
	} = params;

	return useCallback(
		(tasks: UGSTask[], config: UgsHubTaskListConfig): ReactNode => (
			<UgsHubTaskList
				tasks={tasks}
				config={config}
				categoryByType={categoryByType}
				providerByType={providerByType}
				providerDisplayByType={providerDisplayByType}
				displayNameByType={displayNameByType}
				bulkActionMode={bulkActionMode}
				selectedTasks={selectedTasks}
				showUgsAdminLink={showUgsAdminLink}
				onToggleTaskSelection={onToggleTaskSelection}
				onViewResult={onViewResult}
				onDownloadResult={onDownloadResult}
				onCancelTask={onCancelTask}
				onOpenDocEditor={onOpenDocEditor}
				getContentIdFromResult={getContentIdFromResult}
				getTaskIcon={getTaskIcon}
				getStatusColor={getStatusColor}
			/>
		),
		[
			categoryByType,
			providerByType,
			providerDisplayByType,
			displayNameByType,
			bulkActionMode,
			selectedTasks,
			showUgsAdminLink,
			onToggleTaskSelection,
			onViewResult,
			onDownloadResult,
			onCancelTask,
			onOpenDocEditor,
			getContentIdFromResult,
			getTaskIcon,
			getStatusColor,
		]
	);
}
