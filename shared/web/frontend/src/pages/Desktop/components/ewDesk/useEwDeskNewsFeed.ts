/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Paginated EWDesk feed via GET /news (filters, sort, limit/offset pages).
 *
 * Invariants:
 * - Query key includes all server-side filters; page size matches API default (50).
 *
 * Related:
 * - EWDeskApp.tsx, productDesktopApi.ts, ewDeskNewsQueryOptions.ts
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import * as React from 'react';
import type {
	CompanyNewsPostListItem,
	EwDeskNewsFeedFilters,
} from '../../services/productDesktopApi';
import { ewDeskNewsPagedInfiniteQueryOptions } from './ewDeskNewsQueryOptions';

export { EWDESK_NEWS_PAGE_SIZE } from './ewDeskNewsQueryOptions';

export function useEwDeskNewsFeed(filters: EwDeskNewsFeedFilters = {}): {
	posts: CompanyNewsPostListItem[];
	serverTotal: number;
	isLoading: boolean;
	isError: boolean;
	isFetching: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
	refetch: () => Promise<unknown>;
} {
	const listQuery = useInfiniteQuery(
		ewDeskNewsPagedInfiniteQueryOptions(filters)
	);

	const posts = React.useMemo(
		() => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
		[listQuery.data?.pages]
	);

	const serverTotal = listQuery.data?.pages[0]?.total ?? 0;

	return {
		posts,
		serverTotal,
		isLoading: listQuery.isLoading,
		isError: listQuery.isError,
		isFetching: listQuery.isFetching,
		isFetchingNextPage: listQuery.isFetchingNextPage,
		hasNextPage: Boolean(listQuery.hasNextPage),
		fetchNextPage: listQuery.fetchNextPage,
		refetch: listQuery.refetch,
	};
}
