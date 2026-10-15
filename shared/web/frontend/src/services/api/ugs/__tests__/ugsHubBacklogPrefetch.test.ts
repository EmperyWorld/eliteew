/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Hub backlog prefetch policy.
 *
 * Related:
 * - services/api/ugs/ugsHubBacklogPrefetch.ts
 */

import { describe, expect, it } from 'vitest';

import type { UgsQueueOpsSnapshot } from '../queueOps';
import {
	shouldPrefetchUgsHubTasksForBacklog,
	UGS_HUB_BACKLOG_PREFETCH_QUEUE_THRESHOLD,
} from '../ugsHubBacklogPrefetch';

function snapshot(
	overrides: Partial<UgsQueueOpsSnapshot> = {}
): UgsQueueOpsSnapshot {
	return {
		status: 'healthy',
		timestamp: new Date().toISOString(),
		postgres: {},
		rabbitmq: {},
		redis: { ugs_worker_leases: {} },
		hints: [],
		...overrides,
	};
}

describe('shouldPrefetchUgsHubTasksForBacklog', () => {
	it('returns false without snapshot', () => {
		expect(shouldPrefetchUgsHubTasksForBacklog(undefined)).toBe(false);
	});

	it('returns true when total_queued meets threshold', () => {
		expect(
			shouldPrefetchUgsHubTasksForBacklog(
				snapshot({
					postgres: {
						total_queued: UGS_HUB_BACKLOG_PREFETCH_QUEUE_THRESHOLD,
					},
				})
			)
		).toBe(true);
	});

	it('returns true for backlog warning hints', () => {
		expect(
			shouldPrefetchUgsHubTasksForBacklog(
				snapshot({
					hints: [
						{
							level: 'warning',
							code: 'main_queue_backlog',
							message: 'backlog',
						},
					],
				})
			)
		).toBe(true);
	});

	it('returns false for healthy low-traffic snapshot', () => {
		expect(
			shouldPrefetchUgsHubTasksForBacklog(
				snapshot({
					postgres: { total_queued: 2, stale_candidates: { total: 0 } },
					hints: [
						{
							level: 'info',
							code: 'active_worker_leases',
							message: 'ok',
						},
					],
				})
			)
		).toBe(false);
	});
});
