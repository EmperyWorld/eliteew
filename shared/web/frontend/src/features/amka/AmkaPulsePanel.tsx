/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the standalone AMKA pulse and projection summary for current clients.
 * The component is feature-owned so Marketing Cabinet can consume AMKA artifacts through a stable boundary.
 *
 * Invariants:
 * - Missing pulse/projection data must render nothing, preserving older AMKA detail responses (except explicit terminal run framing).
 * - User-visible labels come from the marketing i18n namespace until AMKA owns its own namespace.
 *
 * Related:
 * - src/features/amka/AmkaRunQualityHints.tsx
 * - shared/api/services/marketing_cabinet/amka_standalone_projection.py
 */
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { AmkaProjectionSummary } from './AmkaProjectionSummary';
import { hasAmkaStandaloneProjection } from './amkaProjectionModel';
import type { AmkaPulseArtifact, AmkaStandaloneProjection } from './amkaTypes';

function firstItems(items: string[] | undefined, limit = 2): string {
	return (items ?? []).filter(Boolean).slice(0, limit).join(' · ');
}

export function AmkaPulsePanel({
	pulse,
	projection,
	runTerminal = null,
}: {
	pulse?: AmkaPulseArtifact | null;
	projection?: AmkaStandaloneProjection | null;
	/** When set, emphasize container for failed/cancelled runs (honest outcome per pulse policy). */
	runTerminal?: 'failed' | 'cancelled' | null;
}) {
	const { t } = useTranslation('marketing');
	const pulseDoubts = pulse?.doubts?.filter(Boolean) ?? [];
	const pulsePreserved = pulse?.preserved?.filter(Boolean) ?? [];
	const pulseAgreements = pulse?.agreements?.filter(Boolean) ?? [];
	const showPulse =
		Boolean(pulse?.summary) ||
		pulseDoubts.length > 0 ||
		pulsePreserved.length > 0 ||
		Boolean(pulse?.no_change_reason);
	const showProjection = hasAmkaStandaloneProjection(projection);
	const showTerminalLead =
		runTerminal === 'failed' || runTerminal === 'cancelled';

	if (!showPulse && !showProjection && !showTerminalLead) return null;

	const shellClass =
		runTerminal === 'failed'
			? 'border-red-500/40 bg-red-500/10 text-red-50/95'
			: runTerminal === 'cancelled'
				? 'border-amber-500/40 bg-amber-500/10 text-amber-50/95'
				: 'border-[rgb(var(--desktop-accent-rgb)/0.32)] bg-[rgb(var(--desktop-accent-rgb)/0.10)] text-(--desktop-text-primary)';

	return (
		<div
			className={cn(
				'rounded-(--desktop-radius) border px-3 py-2 text-sm wrap-pretty',
				shellClass
			)}
		>
			{showTerminalLead ? (
				<div className="border-b border-(--desktop-border-subtle) pb-2">
					<div className="font-semibold">
						{runTerminal === 'failed'
							? t('amkaView.pulseRunFailedTitle')
							: t('amkaView.pulseRunCancelledTitle')}
					</div>
					<p className="mt-1 text-sm opacity-95">
						{runTerminal === 'failed'
							? t('amkaView.pulseRunFailedLead')
							: t('amkaView.pulseRunCancelledLead')}
					</p>
				</div>
			) : null}
			{showPulse ? (
				<div className={cn(showTerminalLead && 'mt-2')}>
					<div className="font-semibold">{t('amkaView.pulseTitle')}</div>
					{pulse?.summary ? (
						<p className="mt-1 text-(--desktop-text-secondary)">
							{pulse.summary}
						</p>
					) : null}
					{pulse?.no_change_reason ? (
						<p className="mt-1 text-(--desktop-text-secondary)">
							<span className="font-medium text-(--desktop-text-primary)">
								{t('amkaView.pulseNoChangeLabel')}
							</span>{' '}
							{pulse.no_change_reason}
						</p>
					) : null}
					{pulseDoubts.length > 0 ? (
						<p
							className={cn(
								'mt-1',
								runTerminal === 'failed' ? 'text-red-100' : 'text-amber-100'
							)}
						>
							<span className="font-medium">
								{t('amkaView.pulseDoubtsLabel')}
							</span>{' '}
							{firstItems(pulseDoubts)}
						</p>
					) : null}
					{pulsePreserved.length > 0 ? (
						<p className="mt-1 text-(--desktop-text-secondary)">
							<span className="font-medium text-(--desktop-text-primary)">
								{t('amkaView.pulsePreservedLabel')}
							</span>{' '}
							{firstItems(pulsePreserved)}
						</p>
					) : null}
					{pulseAgreements.length > 0 ? (
						<p className="mt-1 text-(--desktop-text-muted)">
							<span className="font-medium">
								{t('amkaView.pulseAgreementsLabel')}
							</span>{' '}
							{firstItems(pulseAgreements)}
						</p>
					) : null}
				</div>
			) : null}
			{showProjection ? (
				<AmkaProjectionSummary
					projection={projection}
					className={cn(
						showPulse && 'mt-2 border-t border-(--desktop-border-subtle) pt-2'
					)}
				/>
			) : null}
		</div>
	);
}
