/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline remediation status badges and navigation for overview gap/integrity issues.
 *
 * Invariants:
 * - Primary section nav precedes task/alert deep-links when primaryView is set.
 *
 * Related:
 * - overviewRemediationHelpers.ts, OverviewAnalyticsPanels.tsx
 */

import { useTranslation } from 'react-i18next';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useMarketingShellClasses } from '@/pages/MarketingCabinet/hooks/useMarketingShellClasses';
import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import type { MarketingIssueRemediation } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { cn } from '@/utils/cn';

import {
	remediationAttentionBadges,
	remediationDeadlineLabel,
	remediationOwnerLabel,
	remediationStateClasses,
	remediationStateLabel,
} from './overviewRemediationHelpers';

export function IssueRemediationStatus({
	remediation,
	onNavigate,
	primaryView,
}: {
	remediation?: MarketingIssueRemediation | null;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	/** Раздел, где устраняется первопричина (JTBD, value, …); показываем до переходов в задачу/алерт */
	primaryView?: MarketingView | null;
}) {
	const { t } = useTranslation('marketing');
	const { toolbarInset } = useMarketingShellClasses();
	const ownerLabel = remediationOwnerLabel(remediation, t);
	const deadlineLabel = remediationDeadlineLabel(remediation, t);
	const metadataLabels = [ownerLabel, deadlineLabel].filter(Boolean);
	const attentionBadges = remediationAttentionBadges(remediation, t);
	const sectionNav =
		primaryView && primaryView !== 'overview' ? primaryView : null;

	return (
		<div className="grid min-w-0 gap-1">
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				{sectionNav ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={() => onNavigate(sectionNav, null)}
					>
						{t('overview.remediation.openTargetSection')}
					</DesktopAppButton>
				) : null}
				<div
					className={cn(
						'rounded-full px-2.5 py-1 text-[11px]',
						remediationStateClasses(remediation, toolbarInset)
					)}
				>
					{remediationStateLabel(remediation, t)}
				</div>
				{remediation?.task_id ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigate('tasks', remediation.task_id)}
					>
						{t('overview.remediation.openTask')}
					</DesktopAppButton>
				) : null}
				{remediation?.alert_id ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="text-(--desktop-text-muted)"
						onClick={() => onNavigate('alerts', remediation.alert_id)}
					>
						{t('overview.remediation.openAlert')}
					</DesktopAppButton>
				) : null}
			</div>
			{attentionBadges.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					{attentionBadges.map((badge) => (
						<div
							key={badge.key}
							className={`rounded-full border px-2.5 py-1 text-[11px] ${badge.className}`}
						>
							{badge.label}
						</div>
					))}
				</div>
			) : null}
			{metadataLabels.length > 0 ? (
				<div className={cn(DESKTOP_TYPOGRAPHY.caption)}>
					{metadataLabels.join(' · ')}
				</div>
			) : null}
		</div>
	);
}
