/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for final assessment metric extraction used by AMKA UI.
 *
 * Invariants:
 * - Uses a stub TFunction (no i18n runtime).
 *
 * Related:
 * - src/features/amka/amkaFinalAssessmentModel.ts
 */
import { describe, expect, it } from 'vitest';

import { buildAmkaFinalAssessmentItems } from './amkaFinalAssessmentModel';

function stubT(key: string, opts?: { value?: string }): string {
	if (opts?.value !== undefined) {
		return `${key}:${opts.value}`;
	}
	return key;
}

describe('buildAmkaFinalAssessmentItems', () => {
	it('returns baseline score rows when present', () => {
		const items = buildAmkaFinalAssessmentItems(
			{
				readiness_score: 80,
				strategy_integrity_score: 70,
				completed_steps_count: 5,
				gaps_count: 1,
			},
			stubT as never
		);
		expect(items.map((i) => i.label)).toEqual([
			'amkaView.finalMetricReadiness',
			'amkaView.finalMetricIntegrity',
			'amkaView.finalMetricCompletedSteps',
			'amkaView.finalMetricGaps',
		]);
		expect(items[0]?.value).toBe('80%');
	});

	it('adds duration metric when elapsed_ms is set', () => {
		const items = buildAmkaFinalAssessmentItems(
			{
				amka_metrics: { elapsed_ms: 1500 },
			},
			stubT as never
		);
		expect(
			items.some((i) => i.label === 'amkaView.finalMetricFinalizeDuration')
		).toBe(true);
	});

	it('returns empty list when payload missing', () => {
		expect(buildAmkaFinalAssessmentItems(undefined, stubT as never)).toEqual(
			[]
		);
	});
});
