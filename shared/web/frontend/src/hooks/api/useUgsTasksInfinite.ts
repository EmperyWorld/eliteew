/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Infinite React Query loader for UGS Hub task lists (offset pages, merge on poll).
 *
 * Related:
 * - services/api/ugsQueryOptions.ts
 * - services/api/ugs/ugsTasksInfiniteQueryUtils.ts
 */

import { useMemo } from 'react';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';

import { flattenUgsTaskPages } from '../../services/api/ugs/ugsTasksInfiniteQueryUtils';
import { ugsQueryKeys } from '../../services/api/ugs/queryKeys';
import { ugsTasksInfiniteQueryOptions } from '../../services/api/ugsQueryOptions';
import { resolveUgsHubTasksPollIntervalMs } from '../../services/api/ugs/ugsHubTasksPolling';
import { useUgsHubActiveStreamPollState } from '../ugsHub/useUgsHubActiveStreamPollState';
import { useUgsHubDocumentVisible } from '../ugsHub/useUgsHubDocumentVisible';
import type { UGSTask } from '../../services/api/ugs/types';

export {
	flattenUgsTaskPages,
	resolveCachedUgsTaskPage,
	resolveUgsTasksNextPageParam,
	UGS_TASKS_INFINITE_GC_MS,
	UGS_TASKS_INFINITE_MAX_PAGES,
} from '../../services/api/ugs/ugsTasksInfiniteQueryUtils';

export interface UseUgsTasksInfiniteOptions {
	status?: string;
	limit?: number;
	pollingEnabled?: boolean;
}

export interface UseUgsTasksInfiniteResult {
	tasks: UGSTask[];
	tasksQueryKey: QueryKey;
	isLoading: boolean;
	isFetching: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
	refetch: () => Promise<unknown>;
	pollInterval: number | false;
}

export function useUgsTasksInfinite(
	options: UseUgsTasksInfiniteOptions = {}
): UseUgsTasksInfiniteResult {
	const {
		status,
		limit = 100,
		pollingEnabled: pollingEnabledOption = true,
	} = options;
	const sanitizedStatus = status && status !== 'all' ? status : undefined;

	const documentVisible = useUgsHubDocumentVisible();
	const pollingEnabled = pollingEnabledOption && documentVisible;

	const { activeStreamCount, compactTasksPoll } =
		useUgsHubActiveStreamPollState();

	const baseFilters = useMemo(
		() => ({
			status: sanitizedStatus,
			limit,
			compact: compactTasksPoll,
		}),
		[sanitizedStatus, limit, compactTasksPoll]
	);

	const tasksQueryKey = useMemo<QueryKey>(
		() => ugsQueryKeys.tasks({ ...baseFilters, offset: 0, infinite: true }),
		[baseFilters]
	);

	const listQuery = useInfiniteQuery({
		...ugsTasksInfiniteQueryOptions(baseFilters),
		refetchInterval: pollingEnabled
			? (query) => {
					const tasksForPoll = flattenUgsTaskPages(query.state.data?.pages);
					return resolveUgsHubTasksPollIntervalMs(tasksForPoll, {
						pollingEnabled,
						activeStreamCount,
						documentVisible,
					});
				}
			: false,
	});

	const tasks = useMemo(
		() => flattenUgsTaskPages(listQuery.data?.pages),
		[listQuery.data?.pages]
	);

	const pollInterval = useMemo(
		(): number | false =>
			resolveUgsHubTasksPollIntervalMs(tasks, {
				pollingEnabled,
				activeStreamCount,
				documentVisible,
			}),
		[activeStreamCount, documentVisible, pollingEnabled, tasks]
	);

	return {
		tasks,
		tasksQueryKey,
		isLoading: listQuery.isLoading,
		isFetching: listQuery.isFetching,
		isFetchingNextPage: listQuery.isFetchingNextPage,
		hasNextPage: Boolean(listQuery.hasNextPage),
		fetchNextPage: () => listQuery.fetchNextPage(),
		refetch: () => listQuery.refetch(),
		pollInterval,
	};
}
