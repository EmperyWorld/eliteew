/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hook/options for UGS billing stats widget polling.
 *
 * Invariants:
 * - Query key is single-source via `ugsBillingStatsQueryOptions`.
 * - Poll cadence stays in hook layer (`useUgsBillingStats`).
 *
 * Related:
 * - services/api/ugs/billing.ts
 */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchUgsBillingStats } from '../../services/api/ugs/billing';
import type { UGSBillingStats } from '../../services/api/ugs/types';

const QUERY_KEY = ['ugs', 'billing', 'stats'] as const;
/** Credits widget poll (was 60s); focus/refetch still available via invalidate. */
const BILLING_REFRESH_MS = 5 * 60 * 1000;

export function ugsBillingStatsQueryOptions() {
	return queryOptions<UGSBillingStats | null, Error>({
		queryKey: QUERY_KEY,
		queryFn: fetchUgsBillingStats,
		staleTime: BILLING_REFRESH_MS,
		refetchOnWindowFocus: false,
	});
}

export const useUgsBillingStats = () => {
	const query = useQuery<UGSBillingStats | null, Error>({
		...ugsBillingStatsQueryOptions(),
		refetchInterval: BILLING_REFRESH_MS,
	});

	const lastUpdated = query.dataUpdatedAt
		? new Date(query.dataUpdatedAt)
		: null;

	return {
		...query,
		lastUpdated,
	};
};

export const UGS_BILLING_STATS_QUERY_KEY = QUERY_KEY;
