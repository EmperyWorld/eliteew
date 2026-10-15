/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide when PATCH /news/my-state should invalidate paginated EWDesk feed queries.
 *
 * Invariants:
 * - Feed invalidation only when cached pages use unread_only or starred_only filters.
 *
 * Related:
 * - useEwDeskUserStateSync.ts, ewDeskNewsPagedQueryKey
 */

import type { QueryClient } from '@tanstack/react-query';
import type { EwDeskNewsFeedFilters } from '../../services/productDesktopApi';
import { ewDeskNewsPagedInvalidationQueryKey } from './ewDeskNewsQueryOptions';

export function ewDeskFeedHasActiveUserScopedFilters(
	queryClient: QueryClient
): boolean {
	for (const [key] of queryClient.getQueriesData({
		queryKey: ewDeskNewsPagedInvalidationQueryKey(),
	})) {
		if (!Array.isArray(key) || key.length < 4) continue;
		const filters = key[3];
		if (!filters || typeof filters !== 'object') continue;
		const { unreadOnly, starredOnly } = filters as EwDeskNewsFeedFilters;
		if (unreadOnly || starredOnly) return true;
	}
	return false;
}
