/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 `queryOptions` / `infiniteQueryOptions` for EWDesk caches.
 *
 * Invariants:
 * - Same options object for `useQuery` / `useInfiniteQuery` and prefetch helpers (single cache key).
 * - Invalidation uses `.queryKey` from these helpers, not duplicated literals.
 * - News blob queries do not refetch on focus/reconnect/remount; object URLs live until cache GC.
 *
 * Related:
 * - useEwDeskNewsCounts.ts, useEwDeskNewsDesktopPrefetch.ts, useEwDeskUserStateSync.ts
 * - useEwDeskNewsFeed.ts, EWDeskApp.tsx, useEwDeskNewsBlob.ts, ewDeskNewsQueryInvalidation.ts
 */

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
	ewDeskNewsPagedQueryKey,
	ewDeskNewsWidgetPreviewQueryKey,
	fetchEwDeskNewsCounts,
	fetchEwDeskNewsUserState,
	fetchEwDeskNewsWidgetPreview,
	fetchNewsPost,
	fetchPublishedNewsPage,
	type EwDeskNewsFeedFilters,
} from '../../services/productDesktopApi';

/** Shared React Query scope roots — use for prefix invalidation and key assembly. */
export const EWDESK_PRODUCT_DESKTOP_ROOT = ['product-desktop'] as const;
export const EWDESK_NEWS_SCOPE_ROOT = ['product-desktop', 'news'] as const;
export const EWDESK_NEWS_PAGED_SCOPE_ROOT = [
	...EWDESK_NEWS_SCOPE_ROOT,
	'paged',
] as const;
export const EWDESK_NEWS_COUNTS_ROOT = [
	'product-desktop',
	'news-counts',
] as const;
export const EWDESK_NEWS_USER_STATE_ROOT = [
	'product-desktop',
	'news-my-state',
] as const;
export const EWDESK_NEWS_BLOB_SCOPE_ROOT = [
	'product-desktop',
	'news-blob',
] as const;

export const EWDESK_NEWS_COUNTS_STALE_MS = 30_000;
export const EWDESK_NEWS_USER_STATE_STALE_MS = 60_000;
export const EWDESK_NEWS_DETAIL_STALE_MS = 60_000;
export const EWDESK_NEWS_FEED_STALE_MS = 60_000;
export const EWDESK_NEWS_FEED_GC_MS = 300_000;
export const EWDESK_NEWS_BLOB_STALE_MS = 60 * 60 * 1000;
export const EWDESK_NEWS_BLOB_GC_MS = 30 * 60 * 1000;
export const EWDESK_NEWS_PAGE_SIZE = 50;

/** Prefix invalidation: post detail, paged feed, widget preview (not counts/user-state/blob). */
export function ewDeskNewsInvalidationQueryKey() {
	return EWDESK_NEWS_SCOPE_ROOT;
}

/** Prefix scan for cached paginated feed queries (filter-aware invalidation). */
export function ewDeskNewsPagedInvalidationQueryKey() {
	return EWDESK_NEWS_PAGED_SCOPE_ROOT;
}

export function ewDeskNewsBlobQueryKey(cacheKey: string) {
	return [...EWDESK_NEWS_BLOB_SCOPE_ROOT, cacheKey] as const;
}

export function ewDeskNewsCountsQueryOptions() {
	return queryOptions({
		queryKey: EWDESK_NEWS_COUNTS_ROOT,
		queryFn: fetchEwDeskNewsCounts,
		staleTime: EWDESK_NEWS_COUNTS_STALE_MS,
	});
}

export function ewDeskNewsCountsQueryKey() {
	return ewDeskNewsCountsQueryOptions().queryKey;
}

export function ewDeskNewsUserStateQueryOptions() {
	return queryOptions({
		queryKey: EWDESK_NEWS_USER_STATE_ROOT,
		queryFn: fetchEwDeskNewsUserState,
		staleTime: EWDESK_NEWS_USER_STATE_STALE_MS,
	});
}

export function ewDeskNewsUserStateQueryKey() {
	return ewDeskNewsUserStateQueryOptions().queryKey;
}

export function ewDeskNewsPostQueryOptions(postId: string) {
	return queryOptions({
		queryKey: [...EWDESK_NEWS_SCOPE_ROOT, postId] as const,
		queryFn: () => fetchNewsPost(postId),
		staleTime: EWDESK_NEWS_DETAIL_STALE_MS,
	});
}

export function ewDeskNewsPostQueryKey(postId: string) {
	return ewDeskNewsPostQueryOptions(postId).queryKey;
}

export function ewDeskNewsWidgetPreviewQueryOptions(limit: number) {
	return queryOptions({
		queryKey: ewDeskNewsWidgetPreviewQueryKey(limit),
		queryFn: () => fetchEwDeskNewsWidgetPreview(limit),
		staleTime: EWDESK_NEWS_DETAIL_STALE_MS,
	});
}

export function ewDeskNewsPagedInfiniteQueryOptions(
	filters: EwDeskNewsFeedFilters = {}
) {
	return infiniteQueryOptions({
		queryKey: ewDeskNewsPagedQueryKey(filters),
		queryFn: ({ pageParam }) =>
			fetchPublishedNewsPage({
				...filters,
				limit: EWDESK_NEWS_PAGE_SIZE,
				...(typeof pageParam === 'string'
					? { cursor: pageParam }
					: { offset: pageParam }),
			}),
		initialPageParam: 0 as number | string,
		getNextPageParam: (lastPage, _pages, lastPageParam) => {
			if (lastPage.next_cursor) {
				return lastPage.next_cursor;
			}
			if (typeof lastPageParam === 'string') {
				return undefined;
			}
			const offset = typeof lastPageParam === 'number' ? lastPageParam : 0;
			const next = offset + lastPage.items.length;
			return next < lastPage.total ? next : undefined;
		},
		staleTime: EWDESK_NEWS_FEED_STALE_MS,
		gcTime: EWDESK_NEWS_FEED_GC_MS,
		placeholderData: (previousData) => previousData,
	});
}

export function ewDeskNewsBlobQueryOptions(
	cacheKey: string,
	queryFn: () => Promise<string>
) {
	return queryOptions({
		queryKey: ewDeskNewsBlobQueryKey(cacheKey),
		queryFn,
		staleTime: EWDESK_NEWS_BLOB_STALE_MS,
		gcTime: EWDESK_NEWS_BLOB_GC_MS,
		retry: 1,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		refetchOnMount: false,
	});
}
