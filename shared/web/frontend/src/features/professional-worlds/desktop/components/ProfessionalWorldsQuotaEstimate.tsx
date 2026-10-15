/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-run credit estimate strip for Professional Worlds AI launches (playbooks and actions).
 *
 * Invariants:
 * - Copy uses neutral "credits" wording; estimates are hints only and never block Run.
 * - Low-balance warning appears only when balance and estimate are both known numbers.
 *
 * Related:
 * - hooks/useProfessionalWorldsQuota.ts
 * - ProfessionalPlaybooksRuntimePanel.tsx
 * - AiActionLauncher.tsx
 */

import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsStatusBanner } from '../layout';
import type {
	RealtorQuotaPlaybookEstimate,
	RealtorQuotaSummary,
} from '../types';

function formatCredits(value: number): string {
	if (!Number.isFinite(value)) {
		return '0';
	}
	const rounded = Math.round(value * 100) / 100;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export type ProfessionalWorldsQuotaEstimateProps = {
	loading?: boolean;
	error?: string | null;
	summary?: RealtorQuotaSummary | null;
	playbookEstimate?: RealtorQuotaPlaybookEstimate | null;
	showBalanceSummary?: boolean;
};

export function ProfessionalWorldsQuotaEstimate({
	loading = false,
	error = null,
	summary = null,
	playbookEstimate = null,
	showBalanceSummary = false,
}: ProfessionalWorldsQuotaEstimateProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	if (loading) {
		return (
			<p
				className="text-[11px] leading-relaxed text-(--desktop-text-muted)"
				data-testid="pw-quota-loading"
			>
				{t('quota.loading')}
			</p>
		);
	}

	if (error) {
		return (
			<p
				className="text-[11px] leading-relaxed text-(--desktop-text-muted)"
				data-testid="pw-quota-error"
			>
				{t('quota.loadFailed')}
			</p>
		);
	}

	const estimateCredits = playbookEstimate?.total_ugs_credits;
	const balance = summary?.credits_balance;
	const used24h = summary?.credits_used_24h;
	const lowBalance =
		typeof balance === 'number' &&
		typeof estimateCredits === 'number' &&
		balance < estimateCredits;

	return (
		<div className="grid gap-1" data-testid="pw-quota-estimate">
			{typeof estimateCredits === 'number' ? (
				<p className="text-[11px] leading-relaxed text-(--desktop-text-secondary)">
					{t('quota.preRunEstimate', {
						credits: formatCredits(estimateCredits),
					})}
				</p>
			) : playbookEstimate ? (
				<p className="text-[11px] leading-relaxed text-(--desktop-text-muted)">
					{t('quota.preRunEstimateUnknown')}
				</p>
			) : null}
			{showBalanceSummary && summary ? (
				<p className="text-[11px] leading-relaxed text-(--desktop-text-muted)">
					{typeof balance === 'number'
						? t('quota.balance', { credits: formatCredits(balance) })
						: null}
					{typeof balance === 'number' && typeof used24h === 'number'
						? ' · '
						: null}
					{typeof used24h === 'number'
						? t('quota.used24h', { credits: formatCredits(used24h) })
						: null}
				</p>
			) : null}
			{lowBalance ? (
				<ProfessionalWorldsStatusBanner kind="warning" role="status">
					{t('quota.insufficient', {
						estimate: formatCredits(estimateCredits as number),
					})}
				</ProfessionalWorldsStatusBanner>
			) : null}
		</div>
	);
}
