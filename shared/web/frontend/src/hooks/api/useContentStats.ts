/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hook/options for content statistics and recent activity snapshot.
 *
 * Invariants:
 * - Stats and recent activity are fetched as one query payload (`ContentStatsData`).
 * - Query key is single-source via `contentStatsQueryOptions`.
 *
 * Related:
 * - services/contentApi.ts
 */
import {
	queryOptions,
	useQuery,
	type UseQueryOptions,
} from '@tanstack/react-query';
import type { APIError } from '../../services/api/client';
import { contentApi } from '../../services/contentApi';

export interface ContentStats {
	totalFiles: number;
	totalSize: number;
	typeDistribution: Record<string, number>;
	topTags: Array<{ tag: string; count: number }>;
	recentActivity: number;
}

/** Matches backend ContentListResponse (GET /api/v1/content) */
export interface ContentListResponse {
	items: Array<{
		id: string;
		name?: string;
		content_type?: string;
		created_at?: string;
		file_size?: number | null;
	}>;
	total: number;
	page: number;
	page_size: number;
	has_more: boolean;
}

export interface ContentStatsData {
	stats: ContentStats;
	recentActivity: ContentListResponse['items'];
}

export const CONTENT_STATS_QUERY_KEY = ['content', 'statistics'] as const;

export function contentStatsQueryOptions() {
	return queryOptions<ContentStatsData, APIError>({
		queryKey: CONTENT_STATS_QUERY_KEY,
		queryFn: async () => {
			const [statsResponse, activityResponse] = await Promise.all([
				contentApi.getStats(),
				contentApi.listContent({
					limit: 5,
					sort_field: 'date',
					sort_order: 'desc',
					list_profile: 'compact',
				}),
			]);

			return {
				stats: statsResponse,
				recentActivity: activityResponse.items ?? [],
			};
		},
		staleTime: 30_000,
		retry: 2,
		refetchOnWindowFocus: false,
	});
}

/**
 * Hook to fetch content statistics and recent activity
 */
export const useContentStats = (
	options?: Omit<
		UseQueryOptions<ContentStatsData, APIError>,
		'queryKey' | 'queryFn'
	>
): ReturnType<typeof useQuery<ContentStatsData, APIError>> => {
	return useQuery<ContentStatsData, APIError>({
		...contentStatsQueryOptions(),
		...options,
	});
};
