/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared UGS Hub task-list polling intervals and active-task detection (dashboard + infinite).
 *
 * Invariants:
 * - While SSE streams are active, callers use compact poll + 60s interval.
 * - Active tasks updated within STALE window keep 15s interval.
 *
 * Related:
 * - hooks/api/useUgsDashboard.ts, hooks/api/useUgsTasksInfinite.ts
 */

import type { UGSTask } from './types';

export const UGS_HUB_ACTIVE_TASK_STATUSES: Array<UGSTask['status']> = [
	'pending',
	'processing',
	'queued',
	'retrying',
];

export const UGS_HUB_ACTIVE_POLL_INTERVAL_MS = 15_000;
export const UGS_HUB_IDLE_POLL_INTERVAL_MS = 30_000;
export const UGS_HUB_STREAMING_POLL_INTERVAL_MS = 60_000;
export const UGS_HUB_STALE_ACTIVE_MS = 10 * 60 * 1000;

export interface ResolveUgsHubTasksPollIntervalOptions {
	pollingEnabled?: boolean;
	activeStreamCount?: number;
	now?: number;
	/** When false, polling pauses (hidden document tab). */
	documentVisible?: boolean;
}

/** True when any task is active and was updated within the stale window. */
export function ugsHubTasksHaveRecentActive(
	tasks: readonly UGSTask[],
	now = Date.now()
): boolean {
	return tasks.some((task) => {
		if (!UGS_HUB_ACTIVE_TASK_STATUSES.includes(task.status)) {
			return false;
		}
		const updated = task.updated_at ? Date.parse(task.updated_at) : 0;
		return Number.isFinite(updated) && now - updated < UGS_HUB_STALE_ACTIVE_MS;
	});
}

/** Resolve adaptive poll interval for Hub task lists (flat or infinite). */
export function resolveUgsHubTasksPollIntervalMs(
	tasks: readonly UGSTask[],
	options: ResolveUgsHubTasksPollIntervalOptions = {}
): number | false {
	const {
		pollingEnabled = true,
		activeStreamCount = 0,
		now = Date.now(),
		documentVisible = true,
	} = options;

	if (!pollingEnabled || !documentVisible) {
		return false;
	}
	if (activeStreamCount > 0) {
		return UGS_HUB_STREAMING_POLL_INTERVAL_MS;
	}
	if (!tasks.length) {
		return UGS_HUB_IDLE_POLL_INTERVAL_MS;
	}
	return ugsHubTasksHaveRecentActive(tasks, now)
		? UGS_HUB_ACTIVE_POLL_INTERVAL_MS
		: UGS_HUB_IDLE_POLL_INTERVAL_MS;
}
