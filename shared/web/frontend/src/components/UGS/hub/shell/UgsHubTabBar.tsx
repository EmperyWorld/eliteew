/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Hub tab bar with task count badges and summary chips.
 *
 * Related:
 * - ugsHubSharedUi.tsx
 */

import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { cn } from '../../../../utils/cn';
import type { UgsHubActiveTab, UgsHubTabItem } from '../types';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubChipClasses,
	ugsHubTabActiveClasses,
	ugsHubTabBarDividerClasses,
	ugsHubTabCountBadgeClasses,
	ugsHubTabIdleClasses,
	ugsHubTabRailClasses,
} from '../ugsHubSharedUi';

export interface UgsHubTabBarProps {
	activeTab: UgsHubActiveTab;
	onTabChange: (tab: UgsHubActiveTab) => void;
	tabs: UgsHubTabItem[];
	totalTasks: number;
	completedCount: number;
	failedCount: number;
}

export const UgsHubTabBar: FC<UgsHubTabBarProps> = ({
	activeTab,
	onTabChange,
	tabs,
	totalTasks,
	completedCount,
	failedCount,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	return (
		<section className="mb-6" data-ugs-hub-guide="tab-rail">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-3 border-b pb-4',
					ugsHubTabBarDividerClasses(theme)
				)}
			>
				<div className={ugsHubTabRailClasses(theme)}>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							title={tab.subtitle}
							onClick={() => onTabChange(tab.id)}
							className={cn(
								'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
								activeTab === tab.id
									? ugsHubTabActiveClasses(theme)
									: ugsHubTabIdleClasses(theme),
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							<tab.icon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<span>{tab.label}</span>
							{tab.count > 0 ? (
								<span className={ugsHubTabCountBadgeClasses(theme)}>
									{tab.count}
								</span>
							) : null}
						</button>
					))}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className={ugsHubChipClasses(theme)}>
						{t('tabBar.total', { count: totalTasks })}
					</span>
					<span
						className={cn(
							ugsHubChipClasses(theme),
							'font-medium text-emerald-600 dark:text-emerald-200/90'
						)}
					>
						{t('tabBar.completed', { count: completedCount })}
					</span>
					<span
						className={cn(
							ugsHubChipClasses(theme),
							'font-medium text-rose-600 dark:text-rose-200/90'
						)}
					>
						{t('tabBar.failed', { count: failedCount })}
					</span>
				</div>
			</div>
		</section>
	);
};
