/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for standalone AMKA projection model helpers.
 * They keep feature rendering stable as backend projection fields evolve.
 *
 * Invariants:
 * - Tests cover pure helpers only; no React rendering or network mocks are needed.
 * - Stage order follows AMKA core lifecycle.
 *
 * Related:
 * - src/features/amka/amkaProjectionModel.ts
 */
import { describe, expect, it } from 'vitest';

import {
	getAmkaProjectionStageCounts,
	getAmkaProjectionStatusCounts,
	getAmkaProjectionTraceCount,
	hasAmkaStandaloneProjection,
} from './amkaProjectionModel';
import type { AmkaStandaloneProjection } from './amkaTypes';

function projection(
	override: Partial<AmkaStandaloneProjection> = {}
): AmkaStandaloneProjection {
	return {
		driver_key: 'marketing_cabinet',
		domain_profile: 'marketing',
		subject: {},
		status: 'completed',
		current_stage: 'final',
		stage_counts: {},
		step_status_counts: {},
		trace_events: [],
		contract: {},
		...override,
	};
}

describe('amkaProjectionModel', () => {
	it('sorts stage counts by AMKA lifecycle order and skips empty values', () => {
		expect(
			getAmkaProjectionStageCounts(
				projection({
					stage_counts: {
						execute: 2,
						audit: 3,
						unknown: 1,
						plan: 0,
						final: 1,
					},
				})
			)
		).toEqual([
			{ stage: 'audit', count: 3 },
			{ stage: 'execute', count: 2 },
			{ stage: 'final', count: 1 },
			{ stage: 'unknown', count: 1 },
		]);
	});

	it('detects projection presence by driver or non-empty stages', () => {
		expect(hasAmkaStandaloneProjection(null)).toBe(false);
		expect(hasAmkaStandaloneProjection(projection({ driver_key: '' }))).toBe(
			false
		);
		expect(
			hasAmkaStandaloneProjection(
				projection({ driver_key: '', stage_counts: { audit: 1 } })
			)
		).toBe(true);
	});

	it('returns trace count safely for missing projection', () => {
		expect(getAmkaProjectionTraceCount(null)).toBe(0);
		expect(
			getAmkaProjectionTraceCount(
				projection({
					trace_events: [
						{ stage: 'audit', event: 'audit.completed' },
						{ stage: 'plan', event: 'plan.completed' },
					],
				})
			)
		).toBe(2);
	});

	it('returns status counts from current and core projection field names', () => {
		expect(
			getAmkaProjectionStatusCounts(
				projection({
					step_status_counts: {
						completed: 2,
						running: 1,
						failed: 0,
					},
				})
			)
		).toEqual([
			{ status: 'running', count: 1 },
			{ status: 'completed', count: 2 },
		]);
		expect(
			getAmkaProjectionStatusCounts({
				...projection(),
				step_status_counts: {},
				task_status_counts: {
					completed: 1,
				},
			})
		).toEqual([{ status: 'completed', count: 1 }]);
	});
});
