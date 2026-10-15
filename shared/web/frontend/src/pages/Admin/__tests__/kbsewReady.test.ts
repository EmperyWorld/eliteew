/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import { formatMetricOrNa, normalizeKbsewReady } from '../kbsew/kbsewReady';

describe('kbsewReady', () => {
	it('maps null ready (404 stub) to n/a with null metrics', () => {
		const view = normalizeKbsewReady(null);
		expect(view.kind).toBe('na');
		expect(view.labelKey).toBe('adminKbsew.overview.ready.na');
		expect(formatMetricOrNa(view.metrics.activeJobs)).toBe('n/a');
	});

	it('detects ready and degraded from loose payloads', () => {
		expect(
			normalizeKbsewReady({
				ready: true,
				metrics: { active_jobs: 2, ingest_success_total: 9 },
			}).kind
		).toBe('ready');
		const degraded = normalizeKbsewReady({
			status: 'degraded',
			detail: 'qdrant slow',
			ingest_failure_total: 1,
		});
		expect(degraded.kind).toBe('degraded');
		expect(degraded.detail).toBe('qdrant slow');
		expect(degraded.metrics.ingestFailure).toBe(1);
	});
});
