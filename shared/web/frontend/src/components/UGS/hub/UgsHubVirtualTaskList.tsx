/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Windowed UGS Hub task list for long feeds (admin history, infinite backlog).
 *
 * Invariants:
 * - Uses variable row height estimates; only mounted when count >= threshold.
 *
 * Related:
 * - ugsHubVirtualList.ts, UgsHubTaskRow.tsx, VirtualVariableList
 */

import { type FC, type ReactNode } from 'react';

import { VirtualVariableList } from '../../shared/VirtualList';
import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../../utils/ugsHumanizeTypeKey';
import { UgsHubTaskRow } from './UgsHubTaskRow';
import type { UgsHubTaskListConfig } from './types';
import {
	UGS_HUB_VIRTUAL_LIST_VIEWPORT_PX,
	estimateUgsHubTaskRowHeight,
} from './ugsHubVirtualList';

export interface UgsHubVirtualTaskListProps {
	tasks: UGSTask[];
	config: UgsHubTaskListConfig;
	categoryByType: Map<string, string>;
	providerByType: Map<string, string>;
	providerDisplayByType: Map<string, string>;
	displayNameByType: Map<string, string>;
	bulkActionMode: boolean;
	selectedTasks: Set<string>;
	showUgsAdminLink: boolean;
	onToggleTaskSelection: (taskId: string) => void;
	onViewResult: (task: UGSTask) => void;
	onDownloadResult: (task: UGSTask) => void;
	onCancelTask: (task: UGSTask) => void;
	onOpenDocEditor: (contentId: string) => void;
	getContentIdFromResult: (result: UGSTask['result']) => string | null;
	getTaskIcon: (typeKey: string) => ReactNode;
	getStatusColor: (status: UGSTask['status']) => string;
}

function buildInputPreview(task: UGSTask): string {
	try {
		const raw = JSON.stringify(task.input_data ?? {}, null, 2);
		return raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
	} catch {
		return '';
	}
}

export const UgsHubVirtualTaskList: FC<UgsHubVirtualTaskListProps> = ({
	tasks,
	config,
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
}) => (
	<div
		className="min-w-0 overflow-x-hidden"
		data-testid="ugs-hub-virtual-task-list"
	>
		<VirtualVariableList
			items={tasks}
			height={UGS_HUB_VIRTUAL_LIST_VIEWPORT_PX}
			overscanCount={6}
			estimateSize={(index) =>
				estimateUgsHubTaskRowHeight(tasks[index], {
					showUgsAdminLink,
					highlightErrors: config.highlightErrors,
				})
			}
			getItemKey={(index) => tasks[index]?.id ?? index}
			renderItem={(task) => {
				const category = categoryByType.get(task.type_key) || 'default';
				const provider = providerByType.get(task.type_key);
				const providerShown =
					providerDisplayByType.get(task.type_key) ?? provider ?? '—';
				const displayName =
					displayNameByType.get(task.type_key) ||
					humanizeTypeKey(task.type_key);

				return (
					<div className="pb-3">
						<UgsHubTaskRow
							task={task}
							config={config}
							category={category}
							providerShown={providerShown}
							displayName={displayName}
							inputPreview={buildInputPreview(task)}
							bulkActionMode={bulkActionMode}
							isSelected={selectedTasks.has(task.id)}
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
					</div>
				);
			}}
		/>
	</div>
);
