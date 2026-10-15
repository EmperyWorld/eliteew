/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Update UGS task list React Query cache for both flat arrays and infinite pages.
 *
 * Related:
 * - hooks/api/useUgsTasksInfinite.ts
 * - components/UGSHub.tsx
 */

import type {
	InfiniteData,
	QueryClient,
	QueryKey,
} from '@tanstack/react-query';

import type { UGSTask } from './types';

function isInfiniteTasksData(value: unknown): value is InfiniteData<UGSTask[]> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'pages' in value &&
		Array.isArray((value as InfiniteData<UGSTask[]>).pages)
	);
}

export function updateUgsTasksInCache(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updater: (tasks: UGSTask[]) => UGSTask[]
): void {
	queryClient.setQueryData(queryKey, (prev: unknown) => {
		if (Array.isArray(prev)) {
			return updater(prev);
		}
		if (isInfiniteTasksData(prev)) {
			return {
				...prev,
				pages: prev.pages.map((page) => updater(page)),
			};
		}
		return prev;
	});
}

export function removeUgsTasksFromCache(
	queryClient: QueryClient,
	queryKey: QueryKey,
	taskIds: readonly string[]
): void {
	const idSet = new Set(taskIds);
	updateUgsTasksInCache(queryClient, queryKey, (tasks) =>
		tasks.filter((task) => !idSet.has(task.id))
	);
}

export function mapUgsTasksInCache(
	queryClient: QueryClient,
	queryKey: QueryKey,
	mapper: (task: UGSTask) => UGSTask
): void {
	updateUgsTasksInCache(queryClient, queryKey, (tasks) =>
		tasks.map((task) => mapper(task))
	);
}
