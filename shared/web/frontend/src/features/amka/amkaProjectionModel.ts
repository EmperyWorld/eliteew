/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalizes standalone AMKA projection data for feature UI components.
 * It keeps rendering decisions out of Marketing Cabinet page code while projection contracts evolve.
 *
 * Invariants:
 * - Helpers are pure and tolerate missing projection fields from older API responses.
 * - Stage ordering follows the AMKA core lifecycle, not object key insertion order.
 *
 * Related:
 * - src/features/amka/AmkaPulsePanel.tsx
 * - shared/api/services/marketing_cabinet/amka_standalone_projection.py
 */
import type { AmkaStandaloneProjection } from './amkaTypes';

const STAGE_ORDER = [
	'snapshot',
	'audit',
	'plan',
	'approval',
	'execute',
	'final',
];

export interface AmkaProjectionStageCount {
	stage: string;
	count: number;
}

export interface AmkaProjectionStatusCount {
	status: string;
	count: number;
}

function sortedPositiveCounts(
	counts: Record<string, number> | undefined,
	order: string[]
): AmkaProjectionStageCount[] {
	return Object.entries(counts ?? {})
		.filter(([, value]) => Number.isFinite(value) && value > 0)
		.sort(([a], [b]) => {
			const ai = order.indexOf(a);
			const bi = order.indexOf(b);
			if (ai >= 0 && bi >= 0) return ai - bi;
			if (ai >= 0) return -1;
			if (bi >= 0) return 1;
			return a.localeCompare(b);
		})
		.map(([stage, count]) => ({ stage, count }));
}

export function getAmkaProjectionStageCounts(
	projection?: AmkaStandaloneProjection | null
): AmkaProjectionStageCount[] {
	return sortedPositiveCounts(projection?.stage_counts, STAGE_ORDER);
}

export function getAmkaProjectionStatusCounts(
	projection?: AmkaStandaloneProjection | null
): AmkaProjectionStatusCount[] {
	const stepCounts = sortedPositiveCounts(projection?.step_status_counts, [
		'running',
		'awaiting_approval',
		'completed',
		'failed',
		'skipped',
		'none',
	]);
	if (stepCounts.length > 0) {
		return stepCounts.map(({ stage, count }) => ({ status: stage, count }));
	}
	return sortedPositiveCounts(projection?.task_status_counts, [
		'running',
		'awaiting_approval',
		'completed',
		'failed',
		'skipped',
		'none',
	]).map(({ stage, count }) => ({ status: stage, count }));
}

export function hasAmkaStandaloneProjection(
	projection?: AmkaStandaloneProjection | null
): boolean {
	return (
		Boolean(projection?.driver_key) ||
		getAmkaProjectionStageCounts(projection).length > 0
	);
}

export function getAmkaProjectionTraceCount(
	projection?: AmkaStandaloneProjection | null
): number {
	return projection?.trace_events?.length ?? 0;
}
