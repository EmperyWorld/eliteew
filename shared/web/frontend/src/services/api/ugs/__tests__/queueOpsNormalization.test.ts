/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for queue-ops snapshot normalization at the service boundary.
 *
 * Invariants:
 * - Legacy stale-candidate keys are mapped to canonical typed keys.
 *
 * Related:
 * - src/services/api/ugs/queueOps.ts
 */

import { describe, expect, it } from 'vitest';

import {
	normalizeUgsQueueOpsSnapshot,
	type UgsQueueOpsSnapshot,
} from '../queueOps';

describe('normalizeUgsQueueOpsSnapshot', () => {
	it('maps legacy stale candidate keys to canonical fields', () => {
		const snapshot = {
			status: 'degraded',
			timestamp: '2026-05-28T00:00:00Z',
			postgres: {
				total_queued: 9,
				stale_candidates: {
					stale_pending_orphaned: 2,
					stale_pending_queue_timeout: 3,
					stale_processing_timeout: 4,
				},
			},
			rabbitmq: { ok: true, queues: [] },
			redis: { ugs_worker_leases: { available: true, active_leases: 1 } },
			hints: [],
		} as UgsQueueOpsSnapshot;

		const normalized = normalizeUgsQueueOpsSnapshot(snapshot);
		const stale = normalized.postgres?.stale_candidates;

		expect(stale?.pending_orphan).toBe(2);
		expect(stale?.pending_in_queue).toBe(3);
		expect(stale?.processing).toBe(4);
		expect(stale?.total).toBe(9);
	});
});
