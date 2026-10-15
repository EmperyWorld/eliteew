/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Recovery summary card for sites needing attention (jobs, reconcile, failed smoke).
 *
 * Invariants:
 * - Presentational only; receives already-derived SiteManagerUxSiteCard.
 *
 * Related:
 * - ../SiteManagerOpsAtoms.tsx
 * - ./siteManagerOpsFormatters.ts
 */
import * as React from 'react';
import type { TFunction } from 'i18next';

import { RowCard } from '../SiteManagerOpsAtoms';
import type { SiteManagerUxSiteCard } from '../../siteManagerUserStatus';
import { formatTranslatedValue } from './siteManagerOpsFormatters';

export const RecoveryCard: React.FC<{
	card: SiteManagerUxSiteCard;
	t: TFunction<'siteStudio'>;
}> = ({ card, t }) => (
	<RowCard>
		<div className="min-w-0 flex-1">
			<div className="text-sm font-medium text-(--desktop-text-primary)">
				{card.instance.site_title || card.instance.site_slug}
			</div>
			<div className="mt-1 text-xs text-(--desktop-text-secondary)">
				{card.activeJob
					? t('siteManager.recovery.activeJob', {
							type: formatTranslatedValue(
								t,
								'siteManager.jobType',
								card.activeJob.task_type
							),
							status: formatTranslatedValue(
								t,
								'siteManager.jobStatus',
								card.activeJob.status
							),
							stage: formatTranslatedValue(
								t,
								'siteManager.jobStage',
								card.activeJob.stage
							),
						})
					: card.failedJob
						? t('siteManager.recovery.failedJob', {
								type: formatTranslatedValue(
									t,
									'siteManager.jobType',
									card.failedJob.task_type
								),
								error: card.failedJob.last_error ?? '—',
							})
						: t(card.descriptionKey)}
			</div>
			{card.reconcileIssues.length ? (
				<ul className="mt-2 space-y-1 text-xs text-(--desktop-text-muted)">
					{card.reconcileIssues.slice(0, 3).map((issue) => (
						<li key={issue.code}>
							{formatTranslatedValue(t, 'siteManager.severity', issue.severity)}
							: {issue.message || issue.next_action}
						</li>
					))}
				</ul>
			) : null}
			{card.smokeResult?.status === 'failed' ? (
				<div className="mt-2 text-xs text-amber-100">
					{t('siteManager.recovery.smokeFailed', {
						failures: card.smokeResult.hard_failure_count,
					})}
				</div>
			) : null}
		</div>
	</RowCard>
);
