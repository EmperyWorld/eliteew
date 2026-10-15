/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import type { KbsewBarrelStatus } from '../kbsewAdminApi';
import {
	canForceReindexBarrel,
	KBSEW_BARREL_STATUS_POLL_MS,
	summarizeForceReindexBarrel,
} from '../kbsew/kbsewBarrelsPolicy';
import { collectKbsewJobMonitorRows } from '../kbsew/kbsewJobFormat';

describe('kbsewBarrelsPolicy', () => {
	it('gates force-reindex on asset_count >= 1', () => {
		expect(canForceReindexBarrel(null)).toBe(false);
		expect(
			canForceReindexBarrel({
				barrel_id: 'b1',
				name: 'B',
				enabled: true,
				driver_type: 'pdf',
				asset_count: 0,
				assets_by_status: {},
				qdrant_collection: 'c',
				active_jobs: [],
				pipeline_fresh: true,
				stale_asset_count: 0,
			})
		).toBe(false);
		expect(
			canForceReindexBarrel({
				barrel_id: 'b1',
				name: 'B',
				enabled: true,
				driver_type: 'pdf',
				asset_count: 2,
				assets_by_status: {},
				qdrant_collection: 'c',
				active_jobs: [],
				pipeline_fresh: true,
				stale_asset_count: 0,
			})
		).toBe(true);
	});

	it('summarizes force-reindex barrel result for i18n copy', () => {
		expect(
			summarizeForceReindexBarrel({
				barrel_id: 'b1',
				queued: 3,
				skipped_active: 1,
				failed: 0,
				jobs: [],
			})
		).toEqual({ queued: 3, skipped: 1, failed: 0 });
	});

	it('exports status poll interval used by Barrels tab', () => {
		expect(KBSEW_BARREL_STATUS_POLL_MS).toBe(4000);
	});
});

describe('KbsewJobMonitor rows (poll contract)', () => {
	it('surfaces active jobs for monitor while status is selected', () => {
		const status: KbsewBarrelStatus = {
			barrel_id: 'b1',
			name: 'B',
			enabled: true,
			driver_type: 'pdf',
			asset_count: 1,
			assets_by_status: {},
			qdrant_collection: 'c',
			pipeline_fresh: true,
			stale_asset_count: 0,
			active_jobs: [
				{
					id: 'j1',
					asset_id: 'a1',
					status: 'running',
					progress_pct: 40,
					message: 'Parsing',
					updated_at: 't',
					trace_id: 'tr-1',
				},
			],
			completed_jobs: [],
		};
		const rows = collectKbsewJobMonitorRows(status);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe('j1');
		expect(rows[0]?.trace_id).toBe('tr-1');
	});

	it('returns empty rows when status is null (no poll target)', () => {
		expect(collectKbsewJobMonitorRows(null)).toEqual([]);
	});
});
