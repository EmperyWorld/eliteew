/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Consolidates UGS Hub task feed: infinite query, coalesced pagination, scroll auto-load, admin backlog prefetch.
 *
 * Invariants:
 * - `fetchNextPage` is coalesced to avoid duplicate parallel page fetches.
 * - Backlog prefetch runs only for UGS admin when queue-ops snapshot indicates backlog.
 *
 * Related:
 * - components/UGSHub.tsx
 * - ugsHubCoalescedFetchNextPage.ts, ugsHubBacklogPrefetch.ts
 */

import { useMemo, useRef } from 'react';
import { useUgsHubTasksBacklogPrefetch } from '../api/useUgsHubTasksBacklogPrefetch';
import { useUgsQueueOpsSnapshot } from '../api/useUgsQueueOpsSnapshot';
import { useUgsTasksAutoLoadMore } from '../api/useUgsTasksAutoLoadMore';
import { useUgsTasksInfinite } from '../api/useUgsTasksInfinite';
import { shouldPrefetchUgsHubTasksForBacklog } from '../../services/api/ugs/ugsHubBacklogPrefetch';
import { createCoalescedFetchNextPage } from '../../services/api/ugs/ugsHubCoalescedFetchNextPage';

const DEFAULT_TASKS_LIMIT = 100;

export type UseUgsHubTasksFeedOptions = {
	showUgsAdminLink: boolean;
	/** When false, scroll sentinel auto-load is disabled (e.g. workflows tab). */
	tasksAutoLoadEnabled: boolean;
	/** Admin backlog prefetch (disabled on workflows tab). */
	backlogPrefetchEnabled: boolean;
	/** When false, pauses /tasks infinite-query polling (e.g. workflows tab). */
	tasksPollingEnabled?: boolean;
	/** When false, skips queue-ops snapshot subscription in feed (backlog prefetch). */
	queueOpsSnapshotEnabled?: boolean;
	tasksLimit?: number;
};

export function useUgsHubTasksFeed({
	showUgsAdminLink,
	tasksAutoLoadEnabled,
	backlogPrefetchEnabled,
	tasksPollingEnabled = true,
	queueOpsSnapshotEnabled = showUgsAdminLink,
	tasksLimit = DEFAULT_TASKS_LIMIT,
}: UseUgsHubTasksFeedOptions) {
	const {
		tasks,
		tasksQueryKey,
		pollInterval,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		refetch: refetchTasks,
	} = useUgsTasksInfinite({
		limit: tasksLimit,
		pollingEnabled: tasksPollingEnabled,
	});

	const fetchNextPageRef = useRef(fetchNextPage);
	fetchNextPageRef.current = fetchNextPage;

	const coalescedFetchNextPage = useMemo(
		() => createCoalescedFetchNextPage(() => fetchNextPageRef.current()),
		[]
	);

	const tasksLoadSentinelRef = useRef<HTMLDivElement | null>(null);

	useUgsTasksAutoLoadMore(tasksLoadSentinelRef, {
		enabled: tasksAutoLoadEnabled && hasNextPage,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage: coalescedFetchNextPage,
	});

	const queueOpsQuery = useUgsQueueOpsSnapshot(queueOpsSnapshotEnabled);

	useUgsHubTasksBacklogPrefetch({
		enabled: backlogPrefetchEnabled,
		queueOps: queueOpsQuery.data,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage: coalescedFetchNextPage,
		loadedTaskCount: tasks.length,
	});

	return {
		tasks,
		tasksQueryKey,
		pollInterval,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		refetchTasks,
		coalescedFetchNextPage,
		tasksLoadSentinelRef,
		queueOpsQuery,
		tasksBacklogPrefetchActive:
			showUgsAdminLink &&
			shouldPrefetchUgsHubTasksForBacklog(queueOpsQuery.data) &&
			hasNextPage,
	};
}
