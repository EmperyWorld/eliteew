/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin results KPI strip: eligible users, completions, completion rate.
 *
 * Related:
 * - SurveysAdminResultsPanel.tsx
 * - features/surveys/desktop/surveyHubLayoutTokens.ts
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	SH_HERO_PANEL_CLASS,
	SH_KPI_GRID_CLASS,
	SH_KPI_TILE_CLASS,
} from '@/features/surveys/desktop/surveyHubLayoutTokens';
import { formatSurveyCompletionRate } from './surveyAdminResultsFormat';

type Props = {
	eligibleUsers: number;
	completedCount: number;
	completionRate: number;
};

export function SurveyAdminResultsKpiHero({
	eligibleUsers,
	completedCount,
	completionRate,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	const tiles = [
		{
			key: 'eligible',
			label: t('admin.resultsKpi.eligible'),
			value: String(eligibleUsers),
		},
		{
			key: 'completed',
			label: t('admin.resultsKpi.completed'),
			value: String(completedCount),
		},
		{
			key: 'rate',
			label: t('admin.resultsKpi.rate'),
			value: formatSurveyCompletionRate(completionRate),
		},
	] as const;

	return (
		<DesktopAppPanel className={cn(SH_HERO_PANEL_CLASS, 'p-0')}>
			<div className="p-5">
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{t('admin.resultsKpi.heading')}
				</h2>
				<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
					{t('admin.resultsKpi.hint')}
				</p>
				<div className={SH_KPI_GRID_CLASS}>
					{tiles.map((tile) => (
						<div key={tile.key} className={SH_KPI_TILE_CLASS}>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-muted)'
								)}
							>
								{tile.label}
							</p>
							<p className="mt-1 text-xl font-semibold tabular-nums text-(--desktop-text-primary)">
								{tile.value}
							</p>
						</div>
					))}
				</div>
			</div>
		</DesktopAppPanel>
	);
}
