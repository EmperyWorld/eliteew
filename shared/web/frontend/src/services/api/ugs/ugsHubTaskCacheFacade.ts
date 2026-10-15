/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified UGS Hub task cache entry point: SSE stream patches, poll merge, list mutations, result TTL cache.
 *
 * Invariants:
 * - `mergeUgsHubTasksPoll` preserves fresher SSE realtime fields when compact poll strips them.
 * - Result cache entries expire after `UGS_HUB_RESULT_CACHE_TTL_MS` (5 minutes).
 * - Stream patches update all `['ugs','tasks',…]` React Query caches plus per-task status key.
 *
 * Related:
 * - hooks/ugsHub/useUgsHubTaskActions.ts, hooks/api/useUgsTasksInfinite.ts
 * - patchUgsTasksQueryCache.ts, patchUgsTasksListCache.ts, taskRealtime.ts
 */

import { useRef } from 'react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import {
	mapUgsTasksInCache,
	removeUgsTasksFromCache,
	updateUgsTasksInCache,
} from './patchUgsTasksListCache';
import {
	patchUgsTasksQueryCacheFromStream,
	type UgsTaskStreamSeed,
} from './patchUgsTasksQueryCache';
import { mergeUgsTasksPoll } from './taskRealtime';
import type { UGSStreamEventPayload } from './stream';

export type { UgsTaskStreamSeed };

export type UgsHubResultCacheEntry = {
	data: Pick<UGSTask, 'result' | 'result_preview' | 'metadata'>;
	timestamp: number;
};

export const UGS_HUB_RESULT_CACHE_TTL_MS = 5 * 60 * 1000;

export function createUgsHubResultCache() {
	const cache = new Map<string, UgsHubResultCacheEntry>();
	return {
		get(taskId: string): UgsHubResultCacheEntry | undefined {
			const entry = cache.get(taskId);
			if (!entry) return undefined;
			if (Date.now() - entry.timestamp >= UGS_HUB_RESULT_CACHE_TTL_MS) {
				cache.delete(taskId);
				return undefined;
			}
			return entry;
		},
		set(
			taskId: string,
			data: Pick<UGSTask, 'result' | 'result_preview' | 'metadata'>
		) {
			cache.set(taskId, { data, timestamp: Date.now() });
		},
	};
}

/** Stable ref-backed result cache for Hub modal fetches. */
export function useUgsHubResultCacheRef() {
	return useRef(createUgsHubResultCache());
}

/** Merge polled task rows without clobbering fresher SSE/cache realtime fields. */
export function mergeUgsHubTasksPoll(
	previous: UGSTask[],
	incoming: UGSTask[]
): UGSTask[] {
	return mergeUgsTasksPoll(previous, incoming);
}

/** Merge one infinite-query poll page against the cached slice at the same offset. */
export function mergeUgsHubPollPage(
	previousSlice: UGSTask[],
	incomingPage: UGSTask[]
): UGSTask[] {
	return mergeUgsHubTasksPoll(previousSlice, incomingPage);
}

/** Apply SSE stream payload to all Hub task list caches and per-task status cache. */
export function patchUgsHubTasksFromStream(
	queryClient: QueryClient,
	payload: UGSStreamEventPayload,
	seed?: UgsTaskStreamSeed
): void {
	patchUgsTasksQueryCacheFromStream(queryClient, payload, seed);
}

export function updateUgsHubTasksList(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updater: (tasks: UGSTask[]) => UGSTask[]
): void {
	updateUgsTasksInCache(queryClient, queryKey, updater);
}

export function mapUgsHubTasksInList(
	queryClient: QueryClient,
	queryKey: QueryKey,
	mapper: (task: UGSTask) => UGSTask
): void {
	mapUgsTasksInCache(queryClient, queryKey, mapper);
}

export function removeUgsHubTasksFromList(
	queryClient: QueryClient,
	queryKey: QueryKey,
	taskIds: readonly string[]
): void {
	removeUgsTasksFromCache(queryClient, queryKey, taskIds);
}
