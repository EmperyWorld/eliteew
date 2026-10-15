/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview health preview metrics from run detail payload.
 *
 * Related:
 * - AmkaView.tsx, useAmkaViewQueries.ts
 */

import { useTranslation } from 'react-i18next';

import type { AmkaRunDetailResponse } from '@/services/amka/marketingCabinetAmkaBridge';

type AmkaOverviewHealthPreviewProps = {
	overviewHealthPreview: AmkaRunDetailResponse['overview_health_preview'];
};

export function AmkaOverviewHealthPreview({
	overviewHealthPreview,
}: AmkaOverviewHealthPreviewProps) {
	const { t } = useTranslation('marketing');

	if (!overviewHealthPreview) {
		return null;
	}

	return (
		<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-3 py-2.5">
			<div className="text-xs font-semibold text-(--desktop-text-primary)">
				{t('amkaView.overviewHealthPreviewTitle')}
			</div>
			<p className="mt-1 text-xs text-(--desktop-text-secondary)">
				{t('amkaView.overviewHealthPreviewHint')}
			</p>
			<dl className="mt-2 grid gap-2 sm:grid-cols-3">
				<div>
					<dt className="text-[11px] uppercase tracking-wide text-(--desktop-text-muted)">
						{t('amkaView.overviewHealthReadiness')}
					</dt>
					<dd className="text-sm font-semibold text-(--desktop-text-primary)">
						{overviewHealthPreview.readiness_score}%
					</dd>
				</div>
				<div>
					<dt className="text-[11px] uppercase tracking-wide text-(--desktop-text-muted)">
						{t('amkaView.overviewHealthJtbdVp')}
					</dt>
					<dd className="text-sm font-semibold text-(--desktop-text-primary)">
						{(() => {
							const m = overviewHealthPreview.coverage?.find(
								(x) => x.key === 'jtbd_to_value_props'
							);
							return m && m.total > 0
								? `${m.percentage}% (${m.covered}/${m.total})`
								: '—';
						})()}
					</dd>
				</div>
				<div>
					<dt className="text-[11px] uppercase tracking-wide text-(--desktop-text-muted)">
						{t('amkaView.overviewHealthVpLinked')}
					</dt>
					<dd className="text-sm font-semibold text-(--desktop-text-primary)">
						{(() => {
							const m = overviewHealthPreview.strategy_integrity?.find(
								(x) => x.key === 'value_props_linked_to_jtbd'
							);
							return m && m.total > 0
								? `${m.percentage}% (${m.covered}/${m.total})`
								: '—';
						})()}
					</dd>
				</div>
			</dl>
		</div>
	);
}
