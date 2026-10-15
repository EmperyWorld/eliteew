/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub tab with client-side pagination (history / results).
 *
 * Related:
 * - ugsHubSharedUi.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { cn } from '../../../utils/cn';
import { paginateUgsTasks } from './paginateUgsTasks';
import type { UgsHubRenderTaskList, UgsHubTaskListConfig } from './types';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	UgsHubSectionHeading,
	ugsHubPaginationBarClasses,
	ugsHubPaginationBtnClasses,
	ugsHubTextMuted,
} from './ugsHubSharedUi';

export interface UgsHubPaginatedTasksTabProps {
	sectionLabel: string;
	title: string;
	taskCount: number;
	tasks: UGSTask[];
	page: number;
	itemsPerPage: number;
	onPageChange: (page: number) => void;
	renderTaskList: UgsHubRenderTaskList;
	listConfig: UgsHubTaskListConfig;
}

export const UgsHubPaginatedTasksTab: FC<UgsHubPaginatedTasksTabProps> = ({
	sectionLabel,
	title,
	taskCount,
	tasks,
	page,
	itemsPerPage,
	onPageChange,
	renderTaskList,
	listConfig,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const paginated = paginateUgsTasks(tasks, page, itemsPerPage);
	const pg = paginated.page;
	const from = (pg - 1) * itemsPerPage + 1;
	const to = Math.min(pg * itemsPerPage, paginated.totalItems);

	return (
		<div className="min-w-0 space-y-3">
			<UgsHubSectionHeading
				eyebrow={sectionLabel}
				title={title}
				count={taskCount}
			/>
			{renderTaskList(paginated.items, listConfig)}
			{paginated.hasPagination ? (
				<div className={ugsHubPaginationBarClasses(theme)}>
					<div
						className={cn(
							'min-w-0 text-sm tabular-nums',
							ugsHubTextMuted(theme)
						)}
					>
						{t('pagination.shown', {
							from,
							to,
							total: paginated.totalItems,
						})}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => onPageChange(Math.max(1, pg - 1))}
							disabled={pg <= 1}
							className={ugsHubPaginationBtnClasses(theme, pg <= 1)}
						>
							{t('pagination.prev')}
						</button>
						<span
							className={cn('text-sm tabular-nums', ugsHubTextMuted(theme))}
						>
							{t('pagination.page', {
								page: pg,
								totalPages: paginated.totalPages,
							})}
						</span>
						<button
							type="button"
							onClick={() =>
								onPageChange(Math.min(paginated.totalPages, pg + 1))
							}
							disabled={pg >= paginated.totalPages}
							className={ugsHubPaginationBtnClasses(
								theme,
								pg >= paginated.totalPages
							)}
						>
							{t('pagination.next')}
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
};
