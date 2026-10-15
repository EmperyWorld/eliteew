/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders UGS Hub task rows (bulk select, actions, admin previews).
 *
 * Invariants:
 * - Parent supplies action handlers; this module does not call UGS APIs directly.
 *
 * Related:
 * - UgsHubTaskRow.tsx, UgsHubEmptyState.tsx, useUgsHubRenderTaskList.tsx
 */

import { SparklesIcon } from '@heroicons/react/24/outline';
import { memo, type FC, type ReactNode } from 'react';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { humanizeUgsTypeKey as humanizeTypeKey } from '../../../utils/ugsHumanizeTypeKey';
import { UgsHubEmptyState } from './UgsHubEmptyState';
import { UgsHubTaskRow } from './UgsHubTaskRow';
import { UgsHubVirtualTaskList } from './UgsHubVirtualTaskList';
import type { UgsHubTaskListConfig } from './types';
import { shouldVirtualizeUgsHubTaskList } from './ugsHubVirtualList';

export interface UgsHubTaskListProps {
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

export const UgsHubTaskList: FC<UgsHubTaskListProps> = memo(
	function UgsHubTaskList({
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
	}) {
		if (tasks.length === 0) {
			return (
				<UgsHubEmptyState
					icon={SparklesIcon}
					title={config.emptyTitle}
					description={config.emptyDescription}
					actionLabel={config.emptyActionLabel}
					onAction={config.onEmptyAction}
				/>
			);
		}

		if (shouldVirtualizeUgsHubTaskList(tasks.length)) {
			return (
				<UgsHubVirtualTaskList
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
			);
		}

		return (
			<div className="min-w-0 space-y-3 overflow-x-hidden">
				{tasks.map((task) => {
					const category = categoryByType.get(task.type_key) || 'default';
					const provider = providerByType.get(task.type_key);
					const providerShown =
						providerDisplayByType.get(task.type_key) ?? provider ?? '—';
					const displayName =
						displayNameByType.get(task.type_key) ||
						humanizeTypeKey(task.type_key);

					return (
						<UgsHubTaskRow
							key={task.id}
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
					);
				})}
			</div>
		);
	}
);
