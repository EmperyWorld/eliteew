/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query bundle for UGS Hub: tasks list, stats, types, providers with adaptive polling.
 *
 * Related:
 * - services/api/ugsQueryOptions.ts
 * - services/api/ugs/ugsHubTasksPolling.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';

import { ugsQueryKeys } from '../../services/api/ugs/queryKeys';
import { resolveUgsHubTasksPollIntervalMs } from '../../services/api/ugs/ugsHubTasksPolling';
import {
	UGS_PROVIDERS_POLL_MS,
	UGS_STATS_POLL_MS,
	ugsProvidersQueryOptions,
	ugsStatsQueryOptions,
	ugsTasksQueryOptions,
	ugsTypesQueryOptions,
} from '../../services/api/ugsQueryOptions';
import { useUgsHubActiveStreamPollState } from '../ugsHub/useUgsHubActiveStreamPollState';
import type {
	GenerationType,
	ProvidersSummary,
	ProviderHealth,
	UGSStats,
	UGSTask,
} from '../../services/api/ugs/types';

export interface UseUgsDashboardOptions {
	status?: string;
	limit?: number;
	offset?: number;
	pollingEnabled?: boolean;
	includeTasks?: boolean;
}

export interface UseUgsDashboardResult {
	tasks: UGSTask[];
	stats: UGSStats | null;
	generationTypes: GenerationType[];
	providerSummary: ProvidersSummary | null;
	providerHealth: ProviderHealth[];
	isLoading: boolean;
	isFetching: boolean;
	isError: boolean;
	error: unknown;
	refresh: () => Promise<void>;
	lastUpdated: Date | null;
	tasksQueryKey: QueryKey;
	pollInterval: number | false;
}

export const useUgsDashboard = (
	options: UseUgsDashboardOptions = {}
): UseUgsDashboardResult => {
	const {
		status,
		limit = 150,
		offset = 0,
		pollingEnabled = true,
		includeTasks = true,
	} = options;
	const sanitizedStatus = status && status !== 'all' ? status : undefined;

	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const { activeStreamCount, compactTasksPoll } =
		useUgsHubActiveStreamPollState();

	const tasksListParams = useMemo(
		() => ({
			status: sanitizedStatus,
			limit,
			offset,
			compact: compactTasksPoll,
		}),
		[sanitizedStatus, limit, offset, compactTasksPoll]
	);

	const tasksQueryKey = useMemo<QueryKey>(
		() => ugsQueryKeys.tasks(tasksListParams),
		[tasksListParams]
	);

	const tasksQuery = useQuery({
		...ugsTasksQueryOptions(tasksListParams),
		enabled: includeTasks,
		refetchInterval: pollingEnabled
			? (query) => {
					const data = query.state.data as UGSTask[] | undefined;
					return resolveUgsHubTasksPollIntervalMs(data ?? [], {
						pollingEnabled,
						activeStreamCount,
					});
				}
			: false,
	});

	const statsQuery = useQuery({
		...ugsStatsQueryOptions(),
		refetchInterval: pollingEnabled ? UGS_STATS_POLL_MS : false,
	});

	const typesQuery = useQuery(ugsTypesQueryOptions());

	const providersQuery = useQuery({
		...ugsProvidersQueryOptions(),
		refetchInterval: pollingEnabled ? UGS_PROVIDERS_POLL_MS : false,
	});

	useEffect(() => {
		if (
			tasksQuery.data ||
			statsQuery.data ||
			providersQuery.data ||
			typesQuery.data
		) {
			setLastUpdated(new Date());
		}
	}, [tasksQuery.data, statsQuery.data, providersQuery.data, typesQuery.data]);

	const refresh = useCallback(async (): Promise<void> => {
		await Promise.all([
			tasksQuery.refetch(),
			statsQuery.refetch(),
			typesQuery.refetch(),
			providersQuery.refetch(),
		]);
	}, [providersQuery, statsQuery, tasksQuery, typesQuery]);

	const pollInterval = useMemo(
		(): number | false =>
			resolveUgsHubTasksPollIntervalMs(tasksQuery.data ?? [], {
				pollingEnabled,
				activeStreamCount,
			}),
		[activeStreamCount, pollingEnabled, tasksQuery.data]
	);

	const isLoading =
		tasksQuery.isLoading || statsQuery.isLoading || providersQuery.isLoading;
	const isFetching =
		tasksQuery.isFetching || statsQuery.isFetching || providersQuery.isFetching;
	const isError = Boolean(
		tasksQuery.isError || statsQuery.isError || providersQuery.isError
	);
	const error = tasksQuery.error || statsQuery.error || providersQuery.error;

	return {
		tasks: tasksQuery.data ?? [],
		stats: statsQuery.data ?? null,
		generationTypes: typesQuery.data ?? [],
		providerSummary: providersQuery.data ?? null,
		providerHealth: providersQuery.data?.providers ?? [],
		isLoading,
		isFetching,
		isError,
		error,
		refresh,
		lastUpdated,
		tasksQueryKey,
		pollInterval,
	};
};

export type {
	UGSTask,
	UGSStats,
	GenerationType,
	ProviderHealth,
} from '../../services/api/ugs/types';
