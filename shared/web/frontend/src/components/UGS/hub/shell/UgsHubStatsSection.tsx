/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dashboard stats cards row on UGS Hub overview shell.
 *
 * Related:
 * - ugsHubSharedUi.tsx
 */

import {
	ArrowTrendingUpIcon,
	CheckCircleIcon,
	ServerIcon,
	SignalIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSStats } from '../../../../services/api/ugs/types';
import { DESKTOP_LUCIDE } from '../../../../pages/Desktop/constants';
import { useUgsHubShellTheme } from '../ugsHubShellThemeContext';
import {
	ugsHubIconTileClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from '../ugsHubSharedUi';
import { cn } from '../../../../utils/cn';

export interface UgsHubStatsSectionProps {
	stats: UGSStats;
}

export const UgsHubStatsSection: FC<UgsHubStatsSectionProps> = ({ stats }) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();

	const cards = [
		{
			label: t('stats.active.label'),
			value: stats.active_tasks ?? 0,
			icon: SignalIcon,
			hint: t('stats.active.statusBusy'),
		},
		{
			label: t('stats.completedToday.label'),
			value: stats.completed_today ?? 0,
			icon: CheckCircleIcon,
			hint: t('stats.completedToday.status'),
		},
		{
			label: t('stats.queue.label'),
			value: stats.queue_size ?? 0,
			icon: ServerIcon,
			hint: t('stats.queue.statusBusy'),
		},
		{
			label: t('stats.latency.label'),
			value:
				stats.avg_response_time != null
					? t('stats.latency.valueSeconds', {
							value: stats.avg_response_time.toFixed(1),
						})
					: '—',
			icon: ArrowTrendingUpIcon,
			hint: t('stats.latency.status'),
		},
	];

	return (
		<section
			className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
			data-ugs-hub-guide="stats"
		>
			{cards.map((card) => (
				<div key={card.label} className={cn(ugsHubPanelClasses(theme), 'p-4')}>
					<div className="flex items-start justify-between gap-3">
						<div>
							<p
								className={cn(
									'text-xs font-medium uppercase tracking-wide',
									ugsHubTextMuted(theme)
								)}
							>
								{card.label}
							</p>
							<p
								className={cn(
									'mt-1 text-2xl font-semibold tabular-nums',
									ugsHubTextPrimary(theme)
								)}
							>
								{card.value}
							</p>
							<p className={cn('mt-2 text-xs', ugsHubTextMuted(theme))}>
								{card.hint}
							</p>
						</div>
						<div className={ugsHubIconTileClasses(theme)}>
							<card.icon
								className="h-5 w-5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</div>
					</div>
				</div>
			))}
		</section>
	);
};
