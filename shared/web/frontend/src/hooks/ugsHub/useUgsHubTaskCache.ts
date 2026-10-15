/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub-scoped React Query task cache: binds queryClient + tasksQueryKey to facade mutators and result TTL.
 *
 * Invariants:
 * - `tasksQueryKey` must match the infinite feed query owned by `useUgsHubTasksFeed`.
 * - List mutations only touch the bound key; SSE patches remain global via facade predicate.
 *
 * Related:
 * - hooks/ugsHub/useUgsHubController.ts, useUgsHubTaskActions.ts
 * - services/api/ugs/ugsHubTaskCacheFacade.ts
 */

import {
	useQueryClient,
	type QueryClient,
	type QueryKey,
} from '@tanstack/react-query';
import { useCallback, useMemo, type RefObject } from 'react';

import type { UGSTask } from '../api/useUgsDashboard';
import {
	createUgsHubResultCache,
	mapUgsHubTasksInList,
	type UgsHubResultCacheEntry,
	removeUgsHubTasksFromList,
	updateUgsHubTasksList,
	useUgsHubResultCacheRef,
} from '../../services/api/ugs/ugsHubTaskCacheFacade';

type UgsHubResultCache = ReturnType<typeof createUgsHubResultCache>;

export type UgsHubTaskCacheApi = {
	queryClient: QueryClient;
	tasksQueryKey: QueryKey;
	resultCacheRef: RefObject<UgsHubResultCache>;
	mapTaskInList: (mapper: (task: UGSTask) => UGSTask) => void;
	removeTasksFromList: (taskIds: readonly string[]) => void;
	updateTasksList: (updater: (tasks: UGSTask[]) => UGSTask[]) => void;
	invalidateTasksList: () => Promise<void>;
	refetchTasksList: () => Promise<void>;
	getCachedResult: (taskId: string) => UgsHubResultCacheEntry | undefined;
	setCachedResult: (
		taskId: string,
		data: Pick<UGSTask, 'result' | 'result_preview' | 'metadata'>
	) => void;
};

export function useUgsHubTaskCache(
	tasksQueryKey: QueryKey
): UgsHubTaskCacheApi {
	const queryClient = useQueryClient();
	const resultCacheRef = useUgsHubResultCacheRef();

	const mapTaskInList = useCallback(
		(mapper: (task: UGSTask) => UGSTask) => {
			mapUgsHubTasksInList(queryClient, tasksQueryKey, mapper);
		},
		[queryClient, tasksQueryKey]
	);

	const removeTasksFromList = useCallback(
		(taskIds: readonly string[]) => {
			removeUgsHubTasksFromList(queryClient, tasksQueryKey, taskIds);
		},
		[queryClient, tasksQueryKey]
	);

	const updateTasksList = useCallback(
		(updater: (tasks: UGSTask[]) => UGSTask[]) => {
			updateUgsHubTasksList(queryClient, tasksQueryKey, updater);
		},
		[queryClient, tasksQueryKey]
	);

	const invalidateTasksList = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
	}, [queryClient, tasksQueryKey]);

	const refetchTasksList = useCallback(async () => {
		await queryClient.refetchQueries({ queryKey: tasksQueryKey });
	}, [queryClient, tasksQueryKey]);

	const getCachedResult = useCallback(
		(taskId: string) => resultCacheRef.current.get(taskId),
		[resultCacheRef]
	);

	const setCachedResult = useCallback(
		(
			taskId: string,
			data: Pick<UGSTask, 'result' | 'result_preview' | 'metadata'>
		) => {
			resultCacheRef.current.set(taskId, data);
		},
		[resultCacheRef]
	);

	return useMemo(
		() => ({
			queryClient,
			tasksQueryKey,
			resultCacheRef,
			mapTaskInList,
			removeTasksFromList,
			updateTasksList,
			invalidateTasksList,
			refetchTasksList,
			getCachedResult,
			setCachedResult,
		}),
		[
			queryClient,
			tasksQueryKey,
			resultCacheRef,
			mapTaskInList,
			removeTasksFromList,
			updateTasksList,
			invalidateTasksList,
			refetchTasksList,
			getCachedResult,
			setCachedResult,
		]
	);
}
