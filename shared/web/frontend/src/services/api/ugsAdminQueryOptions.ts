/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 options and key factories for UGS admin snapshots.
 *
 * Invariants:
 * - Snapshot keys are single-source factories used by hooks and invalidation paths.
 * - Poll cadence (`refetchInterval`) remains in hooks; options own key/queryFn/cache policy.
 *
 * Related:
 * - hooks/api/useUgsAdminV2.ts
 * - hooks/api/useUgsQueueOpsSnapshot.ts
 * - services/api/ugsAdminV2.ts
 * - services/api/ugs/queueOps.ts
 */

import { queryOptions } from '@tanstack/react-query';

import {
	getUgsAdminV2Snapshot,
	type UgsAdminV2SnapshotDTO,
} from './ugsAdminV2';
import {
	fetchUgsQueueOpsSnapshot,
	type UgsQueueOpsSnapshot,
} from './ugs/queueOps';

export const UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY = [
	'ugs-admin-v2',
	'snapshot',
] as const;

export const UGS_QUEUE_OPS_QUERY_KEY = ['ugs', 'admin', 'queue-ops'] as const;
export const UGS_QUEUE_OPS_REFRESH_MS = 60_000;
export const UGS_QUEUE_OPS_STALE_MS = 30_000;
export const UGS_QUEUE_OPS_GC_MS = 5 * 60 * 1000;

export function ugsAdminV2SnapshotQueryKey() {
	return UGS_ADMIN_V2_SNAPSHOT_QUERY_KEY;
}

export function ugsAdminV2SnapshotQueryOptions() {
	return queryOptions<UgsAdminV2SnapshotDTO, Error>({
		queryKey: ugsAdminV2SnapshotQueryKey(),
		queryFn: getUgsAdminV2Snapshot,
		staleTime: 0,
	});
}

export function ugsQueueOpsSnapshotQueryKey() {
	return UGS_QUEUE_OPS_QUERY_KEY;
}

export function ugsQueueOpsSnapshotQueryOptions() {
	return queryOptions<UgsQueueOpsSnapshot, Error>({
		queryKey: ugsQueueOpsSnapshotQueryKey(),
		queryFn: fetchUgsQueueOpsSnapshot,
		staleTime: UGS_QUEUE_OPS_STALE_MS,
		gcTime: UGS_QUEUE_OPS_GC_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
	});
}
