/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-side EWDesk feed counts for in-app toolbar badges and desktop icon badge.
 *
 * Invariants:
 * - Query disabled when user is not authenticated.
 *
 * Related:
 * - EWDeskApp.tsx, useEwDeskUnreadCount.ts
 */

import { useQuery } from '@tanstack/react-query';
import { ewDeskNewsCountsQueryOptions } from './ewDeskNewsQueryOptions';

export { ewDeskNewsCountsQueryKey } from './ewDeskNewsQueryOptions';

export function useEwDeskNewsCounts(enabled: boolean): {
	unreadCount: number;
	starredCount: number;
	pinnedCount: number;
	totalPublished: number;
	latestPublishedAt: string | null;
	isLoading: boolean;
} {
	const { data, isLoading } = useQuery({
		...ewDeskNewsCountsQueryOptions(),
		enabled,
		refetchOnWindowFocus: true,
	});
	return {
		unreadCount: data?.unread_count ?? 0,
		starredCount: data?.starred_count ?? 0,
		pinnedCount: data?.pinned_count ?? 0,
		totalPublished: data?.total_published ?? 0,
		latestPublishedAt: data?.latest_published_at ?? null,
		isLoading,
	};
}
