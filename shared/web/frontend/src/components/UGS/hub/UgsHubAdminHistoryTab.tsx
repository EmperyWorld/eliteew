/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub admin-only tab: server-wide generation history (all users).
 *
 * Invariants:
 * - Renders via injected `renderTaskList` (bulk/select stays in UGSHub).
 *
 * Related:
 * - ugsHubSharedUi.tsx, UgsHubVirtualTaskList (>=48 rows)
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { DESKTOP_LUCIDE } from '../../../pages/Desktop/constants';
import { cn } from '../../../utils/cn';
import type { UgsHubRenderTaskList } from './types';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	UgsHubSectionHeading,
	ugsHubInlineErrorPanelClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
} from './ugsHubSharedUi';

export interface UgsHubAdminHistoryTabProps {
	taskCount: number;
	isLoading: boolean;
	isError: boolean;
	tasks: UGSTask[];
	renderTaskList: UgsHubRenderTaskList;
	onManualRefresh: () => void;
}

export const UgsHubAdminHistoryTab: FC<UgsHubAdminHistoryTabProps> = ({
	taskCount,
	isLoading,
	isError,
	tasks,
	renderTaskList,
	onManualRefresh,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	let body: ReactNode;
	if (isLoading) {
		body = (
			<div
				className={cn(
					'flex items-center gap-2 px-4 py-8 text-sm',
					ugsHubPanelClasses(theme),
					ugsHubTextMuted(theme)
				)}
			>
				<ArrowPathIcon
					className="h-5 w-5 animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{t('panels.adminHistory.loading')}
			</div>
		);
	} else if (isError) {
		body = (
			<div className={ugsHubInlineErrorPanelClasses(theme)}>
				{t('panels.adminHistory.loadError')}
			</div>
		);
	} else {
		body = renderTaskList(tasks, {
			emptyTitle: t('panels.adminHistory.emptyTitle'),
			emptyDescription: t('panels.adminHistory.emptyDescription'),
			emptyActionLabel: t('empty.defaultAction'),
			onEmptyAction: onManualRefresh,
			showViewAction: true,
			showDownloadAction: true,
			highlightErrors: true,
		});
	}

	return (
		<div className="min-w-0 space-y-3">
			<UgsHubSectionHeading
				eyebrow={t('panels.adminHistory.eyebrow')}
				title={t('panels.adminHistory.title')}
				count={taskCount}
			/>
			<p className={cn('text-xs', ugsHubTextMuted(theme))}>
				{t('panels.adminHistory.subtitle')}
			</p>
			{body}
		</div>
	);
};
