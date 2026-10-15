/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for UGS Hub backlog prefetch hook scheduling.
 *
 * Related:
 * - hooks/api/useUgsHubTasksBacklogPrefetch.ts
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UgsQueueOpsSnapshot } from '../../../services/api/ugs/queueOps';
import { useUgsHubTasksBacklogPrefetch } from '../useUgsHubTasksBacklogPrefetch';

const backlogSnapshot: UgsQueueOpsSnapshot = {
	status: 'degraded',
	timestamp: new Date().toISOString(),
	postgres: { total_queued: 40 },
	rabbitmq: {},
	redis: { ugs_worker_leases: {} },
	hints: [],
};

describe('useUgsHubTasksBacklogPrefetch', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('schedules fetchNextPage when backlog policy matches', async () => {
		vi.useFakeTimers();
		const fetchNextPage = vi.fn().mockResolvedValue(undefined);

		renderHook(() =>
			useUgsHubTasksBacklogPrefetch({
				enabled: true,
				queueOps: backlogSnapshot,
				hasNextPage: true,
				isFetchingNextPage: false,
				fetchNextPage,
				loadedTaskCount: 100,
			})
		);

		await vi.advanceTimersByTimeAsync(1600);

		expect(fetchNextPage).toHaveBeenCalledTimes(1);
	});

	it('does not fetch when disabled', async () => {
		vi.useFakeTimers();
		const fetchNextPage = vi.fn().mockResolvedValue(undefined);

		renderHook(() =>
			useUgsHubTasksBacklogPrefetch({
				enabled: false,
				queueOps: backlogSnapshot,
				hasNextPage: true,
				isFetchingNextPage: false,
				fetchNextPage,
				loadedTaskCount: 100,
			})
		);

		await vi.advanceTimersByTimeAsync(5000);
		expect(fetchNextPage).not.toHaveBeenCalled();
	});
});
