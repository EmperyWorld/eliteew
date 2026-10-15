/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build UGS Hub tab bar items with counts and i18n subtitles.
 *
 * Invariants:
 * - Workflows and admin_history tabs are admin-only (API + bounce already require UGS admin).
 *
 * Related:
 * - components/UGSHub.tsx, shell/UgsHubTabBar.tsx
 */

import {
	ChartBarSquareIcon,
	ClockIcon,
	EyeIcon,
	PlayIcon,
	ServerIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { UgsHubTabItem } from '../../components/UGS/hub/types';

export interface UseUgsHubTabItemsParams {
	showUgsAdminLink: boolean;
	filteredTasksCount: number;
	filteredActiveCount: number;
	filteredHistoryCount: number;
	filteredCompletedCount: number;
	adminHistoryCount: number;
	workflowTypeCount: number;
}

export function useUgsHubTabItems({
	showUgsAdminLink,
	filteredTasksCount,
	filteredActiveCount,
	filteredHistoryCount,
	filteredCompletedCount,
	adminHistoryCount,
	workflowTypeCount,
}: UseUgsHubTabItemsParams): UgsHubTabItem[] {
	const { t } = useTranslation('ugsHub');

	return useMemo(() => {
		const base: UgsHubTabItem[] = [
			{
				id: 'overview',
				label: t('tabs.overview.label'),
				icon: ChartBarSquareIcon,
				count: filteredTasksCount,
				subtitle: t('tabs.overview.subtitle'),
			},
			{
				id: 'active',
				label: t('tabs.active.label'),
				icon: PlayIcon,
				count: filteredActiveCount,
				subtitle: t('tabs.active.subtitle'),
			},
			{
				id: 'history',
				label: t('tabs.history.label'),
				icon: ClockIcon,
				count: filteredHistoryCount,
				subtitle: t('tabs.history.subtitle'),
			},
			{
				id: 'results',
				label: t('tabs.results.label'),
				icon: EyeIcon,
				count: filteredCompletedCount,
				subtitle: t('tabs.results.subtitle'),
			},
		];

		if (showUgsAdminLink) {
			base.push({
				id: 'workflows',
				label: t('tabs.workflows.label'),
				icon: Squares2X2Icon,
				count: workflowTypeCount,
				subtitle: t('tabs.workflows.subtitle'),
			});
			base.splice(4, 0, {
				id: 'admin_history',
				label: t('tabs.admin_history.label'),
				icon: ServerIcon,
				count: adminHistoryCount,
				subtitle: t('tabs.admin_history.subtitle'),
			});
		}

		return base;
	}, [
		adminHistoryCount,
		filteredActiveCount,
		filteredCompletedCount,
		filteredHistoryCount,
		filteredTasksCount,
		showUgsAdminLink,
		t,
		workflowTypeCount,
	]);
}
