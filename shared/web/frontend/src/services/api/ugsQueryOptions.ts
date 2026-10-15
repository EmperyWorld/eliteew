/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 options for UGS Hub, tray, workflows, and generation polling.
 *
 * Invariants:
 * - Keys come from `ugsQueryKeys`; merge/poll behavior stays in hook layer when stateful.
 *
 * Related:
 * - hooks/api/useUgsDashboard.ts, hooks/api/useUgsTasksInfinite.ts
 * - services/api/ugs/queryKeys.ts
 */

import {
	infiniteQueryOptions,
	queryOptions,
	type QueryKey,
} from '@tanstack/react-query';

import { API_CONFIG } from './config';
import { createAPIClient, type APIError } from './client';
import {
	fetchUgsProviders,
	fetchUgsStats,
	fetchUgsTasks,
	fetchUgsTraySummary,
	fetchUgsTypes,
	type UgsTraySummaryResponse,
} from './ugs/dashboard';
import {
	mergeUgsHubPollPage,
	mergeUgsHubTasksPoll,
} from './ugs/ugsHubTaskCacheFacade';
import {
	resolveCachedUgsTaskPage,
	resolveUgsTasksNextPageParam,
	UGS_TASKS_INFINITE_GC_MS,
} from './ugs/ugsTasksInfiniteQueryUtils';
import { ugsQueryKeys, type UgsTasksQueryFilters } from './ugs/queryKeys';
import type { UGSTask } from './ugs/types';

const ugsClient = createAPIClient({ baseURL: API_CONFIG.ugsBaseURL });

export const UGS_TASKS_STALE_MS = 10_000;
export const UGS_STATS_STALE_MS = 30_000;
export const UGS_STATS_POLL_MS = 60_000;
export const UGS_TYPES_STALE_MS = 60_000;
export const UGS_TYPES_CREATIVE_STUDIO_STALE_MS = 5 * 60 * 1000;
export const UGS_PROVIDERS_STALE_MS = 40_000;
export const UGS_PROVIDERS_POLL_MS = 45_000;
export const UGS_WORKFLOWS_STALE_MS = 15_000;
export const UGS_WORKFLOWS_POLL_MS = 30_000;
export const UGS_DESKTOP_TRAY_STALE_MS = 15_000;
export const UGS_GENERATION_STATUS_POLL_MS = 15_000;

export const UGS_DESKTOP_TRAY_TASKS_QUERY_KEY = [
	'ugs',
	'desktop-tray',
	'summary',
] as const;

export type UgsTasksListQueryParams = {
	status?: string;
	limit?: number;
	offset?: number;
	compact?: boolean;
};

function normalizeUgsTasksListParams(params: UgsTasksListQueryParams) {
	const sanitizedStatus =
		params.status && params.status !== 'all' ? params.status : undefined;
	return {
		status: sanitizedStatus,
		limit: params.limit ?? 150,
		offset: params.offset ?? 0,
		compact: params.compact === true,
	};
}

export function ugsTasksQueryOptions(params: UgsTasksListQueryParams) {
	const normalized = normalizeUgsTasksListParams(params);
	return queryOptions({
		queryKey: ugsQueryKeys.tasks(normalized),
		queryFn: async ({ client, queryKey }) => {
			const incoming = await fetchUgsTasks(normalized);
			const previous = client.getQueryData<UGSTask[]>(queryKey);
			if (!previous?.length) {
				return incoming;
			}
			return mergeUgsHubTasksPoll(previous, incoming);
		},
		staleTime: UGS_TASKS_STALE_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
	});
}

export function ugsTasksInfiniteQueryOptions(
	baseFilters: Omit<UgsTasksQueryFilters, 'offset' | 'infinite'>
) {
	const sanitizedStatus =
		baseFilters.status && baseFilters.status !== 'all'
			? baseFilters.status
			: undefined;
	const limit = baseFilters.limit ?? 100;
	const compact = baseFilters.compact === true;
	const filters = { status: sanitizedStatus, limit, compact };

	return infiniteQueryOptions({
		queryKey: ugsQueryKeys.tasks({ ...filters, offset: 0, infinite: true }),
		queryFn: async ({ pageParam, client, queryKey }) => {
			const offset = typeof pageParam === 'number' ? pageParam : 0;
			const incoming = await fetchUgsTasks({
				...filters,
				offset,
			});
			const previousPages = client.getQueryData<{
				pages: UGSTask[][];
			}>(queryKey);
			const previousPage = resolveCachedUgsTaskPage(
				previousPages?.pages,
				offset,
				limit
			);
			if (!previousPage.length || offset === 0) {
				return incoming;
			}
			return mergeUgsHubPollPage(previousPage, incoming);
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, pages, lastPageParam) =>
			resolveUgsTasksNextPageParam(lastPage, pages, lastPageParam, limit),
		staleTime: UGS_TASKS_STALE_MS,
		gcTime: UGS_TASKS_INFINITE_GC_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
	});
}

export function ugsStatsQueryOptions() {
	return queryOptions({
		queryKey: ugsQueryKeys.stats(),
		queryFn: fetchUgsStats,
		staleTime: UGS_STATS_STALE_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
	});
}

export function ugsTypesQueryOptions() {
	return queryOptions({
		queryKey: ugsQueryKeys.types(),
		queryFn: fetchUgsTypes,
		staleTime: UGS_TYPES_STALE_MS,
		refetchOnWindowFocus: false,
	});
}

export function ugsTypesCreativeStudioQueryOptions() {
	return queryOptions({
		queryKey: ['ugs', 'types', 'creativeStudio'] as const,
		queryFn: fetchUgsTypes,
		staleTime: UGS_TYPES_CREATIVE_STUDIO_STALE_MS,
	});
}

export function ugsProvidersQueryOptions() {
	return queryOptions({
		queryKey: ugsQueryKeys.providers(),
		queryFn: fetchUgsProviders,
		staleTime: UGS_PROVIDERS_STALE_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
	});
}

export function ugsDesktopTraySummaryQueryOptions() {
	return queryOptions<UgsTraySummaryResponse>({
		queryKey: UGS_DESKTOP_TRAY_TASKS_QUERY_KEY,
		queryFn: fetchUgsTraySummary,
		staleTime: UGS_DESKTOP_TRAY_STALE_MS,
		refetchIntervalInBackground: true,
		refetchOnWindowFocus: true,
		notifyOnChangeProps: ['data', 'isError', 'isSuccess'],
	});
}

export function ugsGenerationStatusQueryOptions<TStatus = unknown>(
	requestId: string | undefined
) {
	return queryOptions<TStatus, APIError>({
		queryKey: ugsQueryKeys.taskStatus(requestId),
		queryFn: async () => {
			const { data } = await ugsClient.get<TStatus>(`/status/${requestId}`);
			return data;
		},
		refetchOnWindowFocus: false,
	});
}

export function ugsGenerationResultQueryOptions<TResult = unknown>(
	requestId: string | undefined
) {
	return queryOptions<TResult, APIError>({
		queryKey: ugsQueryKeys.taskResult(requestId),
		queryFn: async () => {
			const { data } = await ugsClient.get<TResult>(`/result/${requestId}`);
			return data;
		},
	});
}

export function ugsWorkflowsQueryOptions<TWorkflows>(
	queryFn: () => Promise<TWorkflows>
) {
	return queryOptions({
		queryKey: ugsQueryKeys.workflows(),
		queryFn,
		staleTime: UGS_WORKFLOWS_STALE_MS,
		refetchOnWindowFocus: false,
	});
}

export function ugsWorkflowExecutionsQueryOptions<TExecutions>(
	workflowId: string,
	queryFn: () => Promise<TExecutions>
) {
	return queryOptions({
		queryKey: ugsQueryKeys.workflowExecutions(workflowId),
		queryFn,
		staleTime: UGS_WORKFLOWS_STALE_MS,
		refetchOnWindowFocus: false,
	});
}

export function ugsComfyuiProviderStatusQueryOptions<TStatus>(
	queryFn: () => Promise<TStatus>
) {
	return queryOptions({
		queryKey: ['ugs', 'providers', 'comfyui', 'status'] as const,
		queryFn,
		staleTime: UGS_WORKFLOWS_STALE_MS,
		refetchOnWindowFocus: false,
	});
}

export function ugsDisabledRunQueryKey(
	factory: (id: string) => QueryKey,
	id: string | undefined,
	placeholderSuffix: string
): QueryKey {
	return id ? factory(id) : (['ugs', placeholderSuffix, ''] as QueryKey);
}
