/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders AMKA quality and pulse hints in the run header.
 * It combines standalone AMKA artifacts with fallback signals in compact operator guidance.
 *
 * Invariants:
 * - Visible text comes from i18n keys, not hardcoded product copy.
 * - Pulse is additive; missing pulse data must preserve the old hints-only rendering.
 *
 * Related:
 * - src/features/amka/AmkaView.tsx
 * - shared/api/services/marketing_cabinet/amka_pulse.py
 */
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import { AmkaPulsePanel } from '@/features/amka/AmkaPulsePanel';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import type {
	AmkaPulseArtifact,
	AmkaStandaloneProjection,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

export function AmkaRunQualityHints({
	planLlmStatus,
	auditFallbackRatio,
	pulse,
	projection,
	runStatus,
}: {
	planLlmStatus?: string | null;
	/** fallback / total из audit_llm_stats */
	auditFallbackRatio?: { fallback: number; total: number } | null;
	pulse?: AmkaPulseArtifact | null;
	projection?: AmkaStandaloneProjection | null;
	/** Persisted marketing run status; drives honest pulse framing when failed/cancelled. */
	runStatus?: string | null;
}) {
	const { t } = useTranslation('marketing');

	const runTerminal =
		runStatus === 'failed'
			? ('failed' as const)
			: runStatus === 'cancelled'
				? ('cancelled' as const)
				: null;

	const showHeuristic = planLlmStatus === 'heuristic_fallback';
	const showAuditStress =
		auditFallbackRatio &&
		auditFallbackRatio.total > 0 &&
		auditFallbackRatio.fallback / auditFallbackRatio.total >= 0.35;
	const showPulse =
		Boolean(pulse?.summary) ||
		Boolean(pulse?.no_change_reason) ||
		(pulse?.doubts?.filter(Boolean).length ?? 0) > 0 ||
		(projection?.trace_events?.length ?? 0) > 0;

	const showTerminalLead =
		runTerminal === 'failed' || runTerminal === 'cancelled';

	if (!showHeuristic && !showAuditStress && !showPulse && !showTerminalLead)
		return null;

	return (
		<section className="space-y-2" aria-label={t('amkaView.qualityHintsAria')}>
			<AmkaPulsePanel
				pulse={pulse}
				projection={projection}
				runTerminal={runTerminal}
			/>
			{showHeuristic ? (
				<div
					className={cn(
						'flex gap-2 rounded-(--desktop-radius) border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-50/95 wrap-pretty'
					)}
				>
					<ExclamationTriangleIcon
						className="mt-0.5 h-4 w-4 shrink-0 text-amber-200"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<div>{t('amkaView.heuristicFallbackUserHint')}</div>
				</div>
			) : null}
			{showAuditStress ? (
				<div
					className={cn(
						'flex gap-2 rounded-(--desktop-radius) border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-50/95 wrap-pretty'
					)}
				>
					<ExclamationTriangleIcon
						className="mt-0.5 h-4 w-4 shrink-0 text-sky-200"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<div>{t('amkaView.auditFallbackStressHint')}</div>
				</div>
			) : null}
		</section>
	);
}
