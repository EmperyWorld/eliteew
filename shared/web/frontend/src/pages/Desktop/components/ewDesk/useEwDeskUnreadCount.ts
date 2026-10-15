/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop icon/taskbar badge: unread EWDesk posts via shared GET /news/counts cache.
 *
 * Invariants:
 * - Query disabled when user is not authenticated.
 * - Same React Query key as useEwDeskNewsCounts (single HTTP round-trip).
 *
 * Related:
 * - useDesktopWorkspaceShellBadgeCounts.ts, useEwDeskNewsCounts.ts
 */

import { useQuery } from '@tanstack/react-query';
import { ewDeskNewsCountsQueryOptions } from './ewDeskNewsQueryOptions';

export { ewDeskNewsCountsQueryKey } from './ewDeskNewsQueryOptions';

export function useEwDeskUnreadCount(enabled: boolean): number {
	const { data } = useQuery({
		...ewDeskNewsCountsQueryOptions(),
		enabled,
		// Socket ``ewdesk.news_updated`` invalidates; HTTP is a slow safety net.
		refetchInterval: enabled ? 300_000 : false,
		refetchOnWindowFocus: true,
	});
	return data?.unread_count ?? 0;
}
