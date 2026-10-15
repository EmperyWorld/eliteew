/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin React Query hook for friends overview — desktop tray / shell badges without
 * pulling the full friends mutation surface or Social Hub UI barrel.
 *
 * Invariants:
 * - Query key must stay `friendsQueryKeys.overview()` (socket invalidation / Social Hub).
 * - Desktop cold path imports this module, not `@/features/friends` barrel.
 *
 * Related:
 * - `hooks/useFriends.ts` (re-exports for Social Hub)
 * - `pages/Desktop/hooks/useDesktopTrayItems.ts`
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getFriendsOverview } from '../api/friendsApi';
import { friendsQueryKeys } from '../api/queryKeys';
import type { FriendsOverview } from '../types';
import { DESKTOP_SHELL_BOOTSTRAP_STALE_MS } from '@/pages/Desktop/services/desktopShellQueryFreshness';

type QueryOptions = {
	enabled?: boolean;
};

/**
 * Balance freshness vs. load: mutations still invalidate the friends query root.
 * staleTime ≥ shell-bootstrap seed window so cold tray does not duplicate overview GET.
 */
const LIVE_FRIENDS_QUERY_OPTIONS = {
	staleTime: DESKTOP_SHELL_BOOTSTRAP_STALE_MS,
	gcTime: 5 * 60_000,
	refetchOnMount: false,
	refetchOnWindowFocus: true,
	refetchOnReconnect: true,
	retry: 2,
} as const;

export function useFriendsOverview(
	options: QueryOptions = {}
): UseQueryResult<FriendsOverview, Error> {
	return useQuery({
		queryKey: friendsQueryKeys.overview(),
		queryFn: getFriendsOverview,
		enabled: options.enabled ?? true,
		...LIVE_FRIENDS_QUERY_OPTIONS,
	});
}
