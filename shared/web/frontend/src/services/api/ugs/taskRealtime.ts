/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge UGS stream payloads and polled task rows for Hub React Query caches.
 *
 * Invariants:
 * - mergeUgsTasksPoll preserves fresher SSE realtime fields when compact poll strips them.
 *
 * Related:
 * - services/api/ugs/patchUgsTasksQueryCache.ts
 * - hooks/api/useUgsDashboard.ts
 */

import type { UGSTask } from './types';
import type { UGSStreamEventPayload } from './stream';

type TaskPatch = Partial<UGSTask> & { id: string };

function normalizeStatus(
	status?: string | null
): UGSTask['status'] | undefined {
	switch (status) {
		case 'queued':
		case 'pending':
		case 'processing':
		case 'retrying':
		case 'completed':
		case 'failed':
		case 'cancelled':
			return status;
		default:
			return undefined;
	}
}

export function buildTaskPatchFromStreamPayload(
	payload: UGSStreamEventPayload
): TaskPatch | null {
	const id = typeof payload.request_id === 'string' ? payload.request_id : null;
	if (!id) {
		return null;
	}

	const metadata =
		payload.metadata &&
		typeof payload.metadata === 'object' &&
		!Array.isArray(payload.metadata)
			? payload.metadata
			: undefined;

	return {
		id,
		status: normalizeStatus(payload.status),
		stage: payload.stage ?? undefined,
		progress:
			typeof payload.progress === 'number' ? payload.progress : undefined,
		progress_message: payload.progress_message ?? undefined,
		execution_backend: payload.execution_backend ?? undefined,
		provider_name: payload.provider_name ?? undefined,
		provider_attempt: payload.provider_attempt ?? undefined,
		retry_count: payload.retry_count ?? undefined,
		queued_at: payload.queued_at ?? undefined,
		last_heartbeat_at:
			payload.last_heartbeat_at ?? payload.timestamp ?? undefined,
		result: payload.result ?? undefined,
		result_preview: payload.result_preview ?? undefined,
		metadata: metadata as UGSTask['metadata'],
		error: payload.error ?? undefined,
		error_type: payload.error_type ?? undefined,
		updated_at: payload.timestamp ?? new Date().toISOString(),
	};
}

export function mergeTaskPatch(
	task: UGSTask,
	patch: Partial<UGSTask>
): UGSTask {
	return {
		...task,
		...patch,
		metadata:
			patch.metadata && typeof patch.metadata === 'object'
				? {
						...(task.metadata ?? {}),
						...patch.metadata,
					}
				: task.metadata,
		result: patch.result ?? task.result,
		result_preview: patch.result_preview ?? task.result_preview,
	};
}

function parseIsoMs(value?: string | null): number {
	if (!value) {
		return 0;
	}
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : 0;
}

const REALTIME_FIELDS: Array<keyof UGSTask> = [
	'progress',
	'stage',
	'progress_message',
	'last_heartbeat_at',
	'execution_backend',
	'provider_name',
	'provider_attempt',
	'retry_count',
];

const COMPACT_POLL_HEAVY_FIELDS: Array<keyof UGSTask> = [
	'input_data',
	'result',
	'result_preview',
	'metadata',
];

/**
 * Merge polled task rows without clobbering fresher SSE/cache realtime fields.
 */
export function mergeUgsTasksPoll(
	previous: UGSTask[],
	incoming: UGSTask[]
): UGSTask[] {
	if (!previous.length) {
		return incoming;
	}
	const previousById = new Map(previous.map((task) => [task.id, task]));
	return incoming.map((incomingTask) => {
		const cached = previousById.get(incomingTask.id);
		if (!cached) {
			return incomingTask;
		}
		const cachedUpdatedMs = parseIsoMs(cached.updated_at);
		const incomingUpdatedMs = parseIsoMs(incomingTask.updated_at);
		if (cachedUpdatedMs <= incomingUpdatedMs) {
			return mergeTaskPatch(cached, incomingTask);
		}
		const preserved: Partial<UGSTask> = {};
		for (const field of REALTIME_FIELDS) {
			const cachedValue = cached[field];
			const incomingValue = incomingTask[field];
			if (
				cachedValue !== undefined &&
				cachedValue !== null &&
				(incomingValue === undefined ||
					incomingValue === null ||
					cachedValue !== incomingValue)
			) {
				(preserved as Record<string, unknown>)[field] = cachedValue;
			}
		}
		for (const field of COMPACT_POLL_HEAVY_FIELDS) {
			const cachedValue = cached[field];
			const incomingValue = incomingTask[field];
			if (
				cachedValue !== undefined &&
				cachedValue !== null &&
				(incomingValue === undefined || incomingValue === null)
			) {
				(preserved as Record<string, unknown>)[field] = cachedValue;
			}
		}
		if (
			cached.status &&
			(cached.status === 'processing' || cached.status === 'retrying') &&
			incomingTask.status === 'pending'
		) {
			preserved.status = cached.status;
		}
		return mergeTaskPatch(incomingTask, preserved);
	});
}
