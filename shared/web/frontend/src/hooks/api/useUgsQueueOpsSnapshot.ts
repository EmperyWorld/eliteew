/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hook for UGS operator queue-ops snapshot (shared by Hub panel and strip).
 *
 * Invariants:
 * - Query key `['ugs', 'admin', 'queue-ops']` is shared across Hub admin widgets.
 * - Polling is visible-tab only and disabled when the hook is disabled.
 *
 * Related:
 * - services/api/ugs/queueOps.ts
 * - components/UGS/hub/UgsHubQueueOpsPanel.tsx
 */

import { useQuery } from '@tanstack/react-query';

import {
	UGS_QUEUE_OPS_QUERY_KEY,
	UGS_QUEUE_OPS_REFRESH_MS,
	ugsQueueOpsSnapshotQueryOptions,
} from '../../services/api/ugsAdminQueryOptions';

export { UGS_QUEUE_OPS_QUERY_KEY };

export function useUgsQueueOpsSnapshot(enabled = true) {
	return useQuery({
		...ugsQueueOpsSnapshotQueryOptions(),
		enabled,
		refetchInterval: enabled ? UGS_QUEUE_OPS_REFRESH_MS : false,
	});
}
