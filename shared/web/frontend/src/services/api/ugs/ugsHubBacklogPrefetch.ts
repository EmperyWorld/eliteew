/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Policy helpers for proactive UGS Hub task page prefetch when queue-ops signals backlog.
 *
 * Invariants:
 * - Prefetch is advisory; scroll-sentinel and manual load-more remain primary paths.
 *
 * Related:
 * - hooks/api/useUgsHubTasksBacklogPrefetch.ts
 * - services/api/ugs/queueOps.ts
 */

import type { UgsQueueOpsSnapshot } from './queueOps';

/** Postgres `total_queued` at or above this triggers prefetch for UGS admins. */
export const UGS_HUB_BACKLOG_PREFETCH_QUEUE_THRESHOLD = 20;

/** Max extra pages prefetched per Hub mount (limit 100 each). */
export const UGS_HUB_BACKLOG_PREFETCH_MAX_PAGES = 3;

const BACKLOG_WARNING_HINT_CODES = new Set([
	'main_queue_backlog',
	'dlq_messages_ready',
	'beat_on_workers_off',
]);

/** Stale candidate total at or above this triggers prefetch. */
export const UGS_HUB_BACKLOG_PREFETCH_STALE_THRESHOLD = 5;

export function shouldPrefetchUgsHubTasksForBacklog(
	snapshot: UgsQueueOpsSnapshot | undefined
): boolean {
	if (!snapshot) {
		return false;
	}

	const queued = Number(snapshot.postgres?.total_queued ?? 0);
	if (
		Number.isFinite(queued) &&
		queued >= UGS_HUB_BACKLOG_PREFETCH_QUEUE_THRESHOLD
	) {
		return true;
	}

	const staleTotal = Number(snapshot.postgres?.stale_candidates?.total ?? 0);
	if (
		Number.isFinite(staleTotal) &&
		staleTotal >= UGS_HUB_BACKLOG_PREFETCH_STALE_THRESHOLD
	) {
		return true;
	}

	return (snapshot.hints ?? []).some(
		(hint) =>
			hint.level === 'warning' && BACKLOG_WARNING_HINT_CODES.has(hint.code)
	);
}
