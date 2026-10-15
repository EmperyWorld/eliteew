/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KPI strip for admin survey catalog (counts by status).
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { SurveyAdminCatalogSummary } from './surveyAdminCatalogUtils';

type Props = {
	summary: SurveyAdminCatalogSummary;
};

export function SurveyAdminCatalogKpiHero({
	summary,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const tiles = [
		{ key: 'total', label: t('admin.catalogKpi.total'), value: summary.total },
		{
			key: 'draft',
			label: t('admin.status.draft'),
			value: summary.draft,
		},
		{
			key: 'published',
			label: t('admin.status.published'),
			value: summary.published,
		},
		{
			key: 'archived',
			label: t('admin.status.archived'),
			value: summary.archived,
		},
	] as const;

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{tiles.map((tile) => (
				<div
					key={tile.key}
					className={cn(
						'rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
						'bg-(--desktop-surface-panel) px-3 py-2.5'
					)}
				>
					<p className={DESKTOP_TYPOGRAPHY.labelOverline}>{tile.label}</p>
					<p className="mt-1 text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
						{tile.value}
					</p>
				</div>
			))}
		</div>
	);
}
