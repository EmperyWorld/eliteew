/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub Overview tab: active queue preview, recent feed, tariffs CTA, failed slice.
 * Launch + see work — not an operator queue console.
 *
 * Related:
 * - ugsHubSharedUi.tsx (UgsHubSectionHeading)
 */

import { BanknotesIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { DESKTOP_LUCIDE } from '../../../pages/Desktop/constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../pages/Desktop/components/DesktopAppChrome';
import { cn } from '../../../utils/cn';
import type { UgsHubRenderTaskList } from './types';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	UgsHubSectionHeading,
	ugsHubHeaderBtnClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from './ugsHubSharedUi';

export interface UgsHubOverviewTabProps {
	renderTaskList: UgsHubRenderTaskList;
	sortedActiveFilteredTasks: UGSTask[];
	sortedFilteredTasks: UGSTask[];
	sortedFailedTasks: UGSTask[];
	filteredActiveTasks: UGSTask[];
	onOpenTariffs: () => void;
	onManualRefresh: () => void;
}

export const UgsHubOverviewTab: FC<UgsHubOverviewTabProps> = ({
	renderTaskList,
	sortedActiveFilteredTasks,
	sortedFilteredTasks,
	sortedFailedTasks,
	filteredActiveTasks,
	onOpenTariffs,
	onManualRefresh,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	return (
		<div className="space-y-6">
			<div className="grid min-w-0 gap-6 xl:grid-cols-2">
				<div className="min-w-0 space-y-3">
					<UgsHubSectionHeading
						eyebrow={t('overview.queueEyebrow')}
						title={t('overview.activeTitle')}
						count={filteredActiveTasks.length}
					/>
					{renderTaskList(sortedActiveFilteredTasks.slice(0, 6), {
						emptyTitle: t('overview.activeEmptyTitle'),
						emptyDescription: t('overview.activeEmptyDescription'),
					})}
				</div>
				<div className="min-w-0 space-y-3">
					<UgsHubSectionHeading
						eyebrow={t('overview.feedEyebrow')}
						title={t('overview.recentTitle')}
						count={sortedFilteredTasks.length}
					/>
					{renderTaskList(sortedFilteredTasks.slice(0, 6), {
						emptyTitle: t('overview.recentEmptyTitle'),
						emptyDescription: t('overview.recentEmptyDescription'),
						emptyActionLabel: t('overview.refreshAction'),
						onEmptyAction: onManualRefresh,
						showViewAction: true,
						showDownloadAction: true,
					})}
				</div>
			</div>

			<div className={cn(ugsHubPanelClasses(theme), 'space-y-3 p-4 md:p-5')}>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0 space-y-1">
						<p
							className={cn(
								'text-xs font-semibold uppercase tracking-wider',
								ugsHubTextMuted(theme)
							)}
						>
							{t('overview.tariffsEyebrow')}
						</p>
						<h3
							className={cn(
								'text-lg font-semibold tracking-tight',
								ugsHubTextPrimary(theme)
							)}
						>
							{t('overview.tariffsTitle')}
						</h3>
						<p
							className={cn(
								'text-xs leading-relaxed',
								ugsHubTextSecondary(theme)
							)}
						>
							{t('overview.tariffsBody')}
						</p>
					</div>
					<button
						type="button"
						onClick={onOpenTariffs}
						className={cn(
							ugsHubHeaderBtnClasses(theme),
							'shrink-0 px-4 py-2.5',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						<BanknotesIcon
							width={18}
							height={18}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('overview.tariffsCta')}
					</button>
				</div>
			</div>

			{sortedFailedTasks.length > 0 ? (
				<div className="min-w-0 space-y-3">
					<UgsHubSectionHeading
						eyebrow={t('overview.problemsEyebrow')}
						title={t('overview.errorsTitle')}
						count={sortedFailedTasks.length}
					/>
					{renderTaskList(sortedFailedTasks.slice(0, 4), {
						emptyTitle: t('overview.errorsEmptyTitle'),
						emptyDescription: t('overview.errorsEmptyDescription'),
						highlightErrors: true,
					})}
				</div>
			) : null}
		</div>
	);
};
