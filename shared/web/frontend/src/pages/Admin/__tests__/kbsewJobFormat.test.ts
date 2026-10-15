/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	collectKbsewJobMonitorRows,
	formatJobProgress,
	formatKbsewRevision,
	jobTraceId,
	revisionLabelOrNa,
} from '../kbsew/kbsewJobFormat';
import type { KbsewBarrelStatus } from '../kbsewAdminApi';

describe('kbsewJobFormat', () => {
	it('formats revision and falls back to n/a', () => {
		expect(formatKbsewRevision(3)).toBe('3');
		expect(formatKbsewRevision(' rev-2 ')).toBe('rev-2');
		expect(formatKbsewRevision(null)).toBeNull();
		expect(revisionLabelOrNa(undefined)).toBe('n/a');
	});

	it('reads optional trace_id from jobs', () => {
		expect(
			jobTraceId({
				id: 'j1',
				asset_id: null,
				status: 'running',
				progress_pct: 10,
				message: null,
				updated_at: '',
				trace_id: '  tr-1  ',
			})
		).toBe('tr-1');
		expect(
			jobTraceId({
				id: 'j2',
				asset_id: null,
				status: 'queued',
				progress_pct: 0,
				message: null,
				updated_at: '',
			})
		).toBeNull();
	});

	it('collects active then completed jobs and clamps progress', () => {
		const status: KbsewBarrelStatus = {
			barrel_id: 'b1',
			name: 'B',
			enabled: true,
			driver_type: 'pdf',
			asset_count: 1,
			assets_by_status: { completed: 1 },
			qdrant_collection: 'kbsew_barrel_b1',
			pipeline_fresh: true,
			stale_asset_count: 0,
			active_jobs: [
				{
					id: 'a1',
					asset_id: 'x',
					status: 'running',
					progress_pct: 150,
					message: 'go',
					updated_at: 't',
					trace_id: 't-a',
				},
			],
			completed_jobs: [
				{
					id: 'c1',
					asset_id: 'y',
					status: 'completed',
					progress_pct: 100,
					message: null,
					updated_at: 't',
				},
			],
		};
		const rows = collectKbsewJobMonitorRows(status);
		expect(rows).toHaveLength(2);
		const active = rows[0];
		expect(active?.phase).toBe('active');
		expect(rows[1]?.phase).toBe('completed');
		expect(active).toBeDefined();
		if (active) {
			expect(formatJobProgress(active)).toBe('100%');
		}
		expect(collectKbsewJobMonitorRows(null)).toEqual([]);
	});
});
