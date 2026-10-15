/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge UGS SSE stream payloads into React Query task list caches (Hub / dashboard).
 *
 * Invariants:
 * - Only queries with key prefix `['ugs', 'tasks', …]` are updated.
 * - Unknown request_id rows are inserted when `seed` is provided (new generation).
 *
 * Related:
 * - services/api/ugs/taskRealtime.ts
 * - services/api/ugs/runUgsGenerationStream.ts
 */

import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { JsonObject } from '@/types/common';

import {
	buildTaskPatchFromStreamPayload,
	mergeTaskPatch,
} from './taskRealtime';
import type { UGSStreamEventPayload } from './stream';
import type { UGSTask } from './types';
import { ugsQueryKeys } from './queryKeys';

function isUgsTasksListQueryKey(queryKey: readonly unknown[]): boolean {
	return (
		queryKey.length >= 2 && queryKey[0] === 'ugs' && queryKey[1] === 'tasks'
	);
}

export interface UgsTaskStreamSeed {
	type_key: string;
	input_data: JsonObject;
	priority: number;
	user_id: string;
}

function buildSeedTask(
	patch: Partial<UGSTask> & { id: string },
	seed: UgsTaskStreamSeed
): UGSTask {
	const now = new Date().toISOString();
	return {
		type_key: seed.type_key,
		status: patch.status ?? 'pending',
		created_at: patch.created_at ?? now,
		updated_at: patch.updated_at ?? now,
		user_id: seed.user_id,
		priority: seed.priority,
		input_data: seed.input_data,
		...patch,
	} as UGSTask;
}

function applyPatchToTaskList(
	prev: UGSTask[] | undefined,
	patch: Partial<UGSTask> & { id: string },
	seed?: UgsTaskStreamSeed
): UGSTask[] | undefined {
	if (!prev) {
		return prev;
	}
	const index = prev.findIndex((task) => task.id === patch.id);
	if (index >= 0) {
		const next = [...prev];
		next[index] = mergeTaskPatch(prev[index], patch);
		return next;
	}
	if (!seed) {
		return prev;
	}
	return [buildSeedTask(patch, seed), ...prev];
}

function applyPatchToTasksCache(
	prev: unknown,
	patch: Partial<UGSTask> & { id: string },
	seed?: UgsTaskStreamSeed
): unknown {
	if (Array.isArray(prev)) {
		return applyPatchToTaskList(prev, patch, seed);
	}
	if (
		prev &&
		typeof prev === 'object' &&
		'pages' in prev &&
		Array.isArray((prev as InfiniteData<UGSTask[]>).pages)
	) {
		const infinite = prev as InfiniteData<UGSTask[]>;
		const taskExists = infinite.pages.some((page) =>
			page.some((task) => task.id === patch.id)
		);
		if (!taskExists && seed) {
			const seedTask = buildSeedTask(patch, seed);
			const firstPage = infinite.pages[0] ?? [];
			return {
				...infinite,
				pages: [[seedTask, ...firstPage], ...infinite.pages.slice(1)],
			};
		}
		return {
			...infinite,
			pages: infinite.pages.map(
				(page) => applyPatchToTaskList(page, patch, undefined) ?? page
			),
		};
	}
	return prev;
}

export function patchUgsTasksQueryCacheFromStream(
	queryClient: QueryClient,
	payload: UGSStreamEventPayload,
	seed?: UgsTaskStreamSeed
): void {
	const patch = buildTaskPatchFromStreamPayload(payload);
	if (!patch) {
		return;
	}

	queryClient.setQueriesData(
		{
			predicate: (query) =>
				isUgsTasksListQueryKey(query.queryKey as readonly unknown[]),
		},
		(prev) => applyPatchToTasksCache(prev, patch, seed)
	);

	const requestId = patch.id;
	queryClient.setQueryData(
		ugsQueryKeys.taskStatus(requestId),
		(prev: Record<string, unknown> | undefined) => ({
			...(prev ?? {}),
			request_id: requestId,
			status: patch.status ?? prev?.status,
			progress: patch.progress ?? prev?.progress,
			stage: patch.stage ?? prev?.stage,
			progress_message: patch.progress_message ?? prev?.progress_message,
			execution_backend: patch.execution_backend ?? prev?.execution_backend,
			provider_name: patch.provider_name ?? prev?.provider_name,
			error: patch.error ?? prev?.error,
			error_type: patch.error_type ?? prev?.error_type,
			metadata: patch.metadata ?? prev?.metadata,
			result: patch.result ?? prev?.result,
		})
	);
}
