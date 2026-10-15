/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize optional KBSEW `/ready` payloads for Overview widgets (graceful degrade).
 *
 * Invariants:
 * - Missing / null ready → UI shows n/a, not a hard failure.
 *
 * Related:
 * - `pages/Admin/kbsewAdminApi.ts` (`fetchKbsewReady`)
 */

import type { KbsewReadyResponse } from '../kbsewAdminApi';

export type KbsewReadyKind = 'ready' | 'degraded' | 'unavailable' | 'na';

export type KbsewReadyView = {
	kind: KbsewReadyKind;
	labelKey:
		| 'adminKbsew.overview.ready.ready'
		| 'adminKbsew.overview.ready.degraded'
		| 'adminKbsew.overview.ready.unavailable'
		| 'adminKbsew.overview.ready.na';
	detail: string | null;
	metrics: {
		activeJobs: number | null;
		ingestSuccess: number | null;
		ingestFailure: number | null;
	};
};

function asFiniteNumber(raw: unknown): number | null {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw === 'string' && raw.trim()) {
		const n = Number(raw);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function pickMetric(raw: KbsewReadyResponse, keys: string[]): number | null {
	const metrics =
		raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : null;
	const root = raw as KbsewReadyResponse & Record<string, unknown>;
	for (const key of keys) {
		const fromMetrics = metrics ? asFiniteNumber(metrics[key]) : null;
		if (fromMetrics != null) return fromMetrics;
		const fromRoot = asFiniteNumber(root[key]);
		if (fromRoot != null) return fromRoot;
	}
	return null;
}

/**
 * Map loose `/ready` JSON (or null when 404) into Overview view model.
 */
export function normalizeKbsewReady(
	raw: KbsewReadyResponse | null
): KbsewReadyView {
	if (raw == null) {
		return {
			kind: 'na',
			labelKey: 'adminKbsew.overview.ready.na',
			detail: null,
			metrics: {
				activeJobs: null,
				ingestSuccess: null,
				ingestFailure: null,
			},
		};
	}

	const statusText =
		typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
	let kind: KbsewReadyKind = 'unavailable';
	if (
		raw.ready === true ||
		statusText === 'ready' ||
		statusText === 'ok' ||
		statusText === 'healthy'
	) {
		kind = 'ready';
	}
	if (
		raw.degraded === true ||
		statusText === 'degraded' ||
		statusText === 'partial'
	) {
		kind = 'degraded';
	}
	if (
		raw.ready === false &&
		kind !== 'degraded' &&
		statusText !== 'ready' &&
		statusText !== 'ok' &&
		statusText !== 'healthy'
	) {
		kind = 'unavailable';
	}

	const detail =
		(typeof raw.detail === 'string' && raw.detail.trim()) ||
		(typeof raw.message === 'string' && raw.message.trim()) ||
		null;

	const labelKey =
		kind === 'ready'
			? 'adminKbsew.overview.ready.ready'
			: kind === 'degraded'
				? 'adminKbsew.overview.ready.degraded'
				: 'adminKbsew.overview.ready.unavailable';

	return {
		kind,
		labelKey,
		detail,
		metrics: {
			activeJobs: pickMetric(raw, ['active_jobs', 'kbsew_active_jobs']),
			ingestSuccess: pickMetric(raw, [
				'ingest_success_total',
				'kbsew_ingest_success_total',
			]),
			ingestFailure: pickMetric(raw, [
				'ingest_failure_total',
				'kbsew_ingest_failure_total',
			]),
		},
	};
}

export function formatMetricOrNa(value: number | null): string {
	return value == null ? 'n/a' : String(value);
}
