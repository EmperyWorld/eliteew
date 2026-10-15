/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers that turn `final_assessment` payloads into compact metric cards and reconcile diagnostics.
 *
 * Invariants:
 * - No React hooks; safe to call from views and Vitest.
 * - Does not import from `pages/MarketingCabinet` (local field readers only).
 *
 * Related:
 * - src/features/amka/AmkaFinalAssessmentSection.tsx
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 */
import type { TFunction } from 'i18next';

export type AmkaFinalMetricItem = { label: string; value: string };
export type AmkaReconcileDetailItem = {
	key: string;
	label: string;
	status: string;
	confidence: string;
	reason: string;
};

function readNumberField(
	payload: Record<string, unknown> | null | undefined,
	key: string
): number | null {
	const value = payload?.[key];
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function readBooleanField(
	payload: Record<string, unknown> | null | undefined,
	key: string
): boolean | null {
	const value = payload?.[key];
	return typeof value === 'boolean' ? value : null;
}

/**
 * Build human-facing metric rows for the final assessment spoiler (Marketing Cabinet AMKA).
 */
export function buildAmkaFinalAssessmentItems(
	finalAssessment: Record<string, unknown> | null | undefined,
	t: TFunction<'marketing'>
): AmkaFinalMetricItem[] {
	if (!finalAssessment) return [];
	const readiness = readNumberField(finalAssessment, 'readiness_score');
	const integrity = readNumberField(
		finalAssessment,
		'strategy_integrity_score'
	);
	const completedSteps = readNumberField(
		finalAssessment,
		'completed_steps_count'
	);
	const gapsCount = readNumberField(finalAssessment, 'gaps_count');
	const amkaMetricsRaw = finalAssessment.amka_metrics;
	const metricExtras: AmkaFinalMetricItem[] = [];
	if (
		amkaMetricsRaw &&
		typeof amkaMetricsRaw === 'object' &&
		!Array.isArray(amkaMetricsRaw)
	) {
		const m = amkaMetricsRaw as Record<string, unknown>;
		const elapsedMs = readNumberField(m, 'elapsed_ms');
		if (elapsedMs !== null && elapsedMs >= 0) {
			const sec = elapsedMs / 1000;
			const value =
				sec < 60
					? t('amkaView.finalMetricDurationSeconds', {
							value: sec.toFixed(1),
						})
					: t('amkaView.finalMetricDurationMinutes', {
							value: String(Math.max(1, Math.round(sec / 60))),
						});
			metricExtras.push({
				label: t('amkaView.finalMetricFinalizeDuration'),
				value,
			});
		}
		if (readBooleanField(m, 'prompt_too_large') === true) {
			metricExtras.push({
				label: t('amkaView.finalMetricCompactInput'),
				value: t('amkaView.finalMetricYes'),
			});
		}
		const llmOff = readBooleanField(m, 'llm_disabled_by_operator') === true;
		const llmUsed = readBooleanField(m, 'llm_used');
		if (llmOff || llmUsed !== null) {
			let summaryValue: string;
			if (llmOff) {
				summaryValue = t('amkaView.finalMetricAutoSummaryOperatorOff');
			} else if (llmUsed) {
				summaryValue = t('amkaView.finalMetricAutoSummaryOn');
			} else {
				summaryValue = t('amkaView.finalMetricAutoSummaryOff');
			}
			metricExtras.push({
				label: t('amkaView.finalMetricAutoSummary'),
				value: summaryValue,
			});
		}
	}
	return [
		readiness === null
			? null
			: {
					label: t('amkaView.finalMetricReadiness'),
					value: `${readiness}%`,
				},
		integrity === null
			? null
			: {
					label: t('amkaView.finalMetricIntegrity'),
					value: `${integrity}%`,
				},
		completedSteps === null
			? null
			: {
					label: t('amkaView.finalMetricCompletedSteps'),
					value: String(completedSteps),
				},
		gapsCount === null
			? null
			: {
					label: t('amkaView.finalMetricGaps'),
					value: String(gapsCount),
				},
		...metricExtras,
	].filter((item): item is AmkaFinalMetricItem => Boolean(item));
}

export function buildAmkaReconcileDetailItems(
	finalAssessment: Record<string, unknown> | null | undefined
): AmkaReconcileDetailItem[] {
	const raw =
		finalAssessment?.strategy_graph_reconcile &&
		typeof finalAssessment.strategy_graph_reconcile === 'object' &&
		!Array.isArray(finalAssessment.strategy_graph_reconcile)
			? (finalAssessment.strategy_graph_reconcile as Record<string, unknown>)
					.structured_details
			: null;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter(
			(item): item is Record<string, unknown> =>
				Boolean(item) && typeof item === 'object' && !Array.isArray(item)
		)
		.slice(0, 12)
		.map((item) => {
			const source = String(item.source_entity_type ?? 'entity');
			const target = String(item.target_entity_type ?? 'target');
			const linkKind = String(item.link_kind ?? 'link');
			const confidence =
				typeof item.confidence === 'number' && Number.isFinite(item.confidence)
					? item.confidence.toFixed(2)
					: '—';
			const key = [
				item.source_entity_id,
				item.target_entity_id,
				item.link_kind,
				item.action,
			]
				.map((value) => String(value ?? '').trim())
				.filter(Boolean)
				.join(':');
			return {
				key: key || `${source}:${target}:${linkKind}`,
				label: `${source} → ${target} · ${linkKind}`,
				status: String(item.action ?? 'candidate'),
				confidence,
				reason: String(item.reason ?? '—'),
			};
		});
}
