/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads the atomic desktop-children and Unified Content file projection for one folder UI context.
 *
 * Invariants:
 * - Exactly one of folderItemId or unfiled may select the folder context.
 * - Desktop and Content Manager refresh events refetch the same atomic read contract.
 * - TanStack Query caches folder-view with staleTime + keepPreviousData for snappy folder switches.
 *
 * Related:
 * - src/services/contentApi.ts
 * - src/pages/Desktop/hooks/useFolderContents.ts
 * - src/pages/ContentManager/ContentManagerPro.tsx
 */
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import type { Content as ContentItem } from '@/components/UnifiedContent/types';
import {
	contentApi,
	type FolderViewQuery,
	type FolderViewResult,
	toContentError,
} from '@/services/contentApi';
import {
	CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
	DESKTOP_ITEMS_REFRESH_EVENT,
} from '@/services/unifiedContentEvents';

export const FOLDER_VIEW_STALE_TIME_MS = 15_000;

export interface UseFolderViewOptions extends FolderViewQuery {
	enabled?: boolean;
	/** Let the owning surface trigger the initial request when it already has a list lifecycle effect. */
	auto?: boolean;
}

export function folderViewQueryKey(query: FolderViewQuery) {
	return ['contentManager', 'folderView', query] as const;
}

export function useFolderView({
	enabled = true,
	auto = true,
	folderItemId,
	unfiled = false,
	search,
	sort,
	limit,
	offset,
	contentType,
	mimeType,
	minFileSize,
	processingStatus,
}: UseFolderViewOptions) {
	const queryClient = useQueryClient();
	const sortField = sort?.field;
	const sortOrder = sort?.order;

	const query = useMemo<FolderViewQuery>(
		() => ({
			folderItemId,
			unfiled,
			search: search?.trim() || undefined,
			sort:
				sortField || sortOrder
					? { field: sortField, order: sortOrder }
					: undefined,
			limit,
			offset,
			contentType: contentType?.trim() || undefined,
			mimeType: mimeType?.trim() || undefined,
			minFileSize:
				minFileSize != null && minFileSize >= 0 ? minFileSize : undefined,
			processingStatus: processingStatus?.trim() || undefined,
		}),
		[
			contentType,
			mimeType,
			folderItemId,
			limit,
			minFileSize,
			offset,
			processingStatus,
			search,
			sortField,
			sortOrder,
			unfiled,
		]
	);

	const queryKey = folderViewQueryKey(query);
	/** When auto=false, the owner drives fetch via refetch()/fetchQuery; cache still shared. */
	const folderQuery = useQuery({
		queryKey,
		queryFn: ({ signal }) => contentApi.getFolderView(query, { signal }),
		enabled: enabled && auto,
		staleTime: FOLDER_VIEW_STALE_TIME_MS,
		placeholderData: keepPreviousData,
	});

	const refetch = useCallback(async (): Promise<FolderViewResult | null> => {
		if (!enabled) return null;
		try {
			const data = await queryClient.fetchQuery({
				queryKey,
				queryFn: ({ signal }) => contentApi.getFolderView(query, { signal }),
				staleTime: FOLDER_VIEW_STALE_TIME_MS,
			});
			return data;
		} catch (cause) {
			if (
				cause &&
				typeof cause === 'object' &&
				'name' in cause &&
				(cause as { name?: string }).name === 'AbortError'
			) {
				return null;
			}
			return null;
		}
	}, [enabled, query, queryClient, queryKey]);

	useEffect(() => {
		if (!enabled || typeof window === 'undefined') return;
		const onRefresh = () => {
			void queryClient.invalidateQueries({
				queryKey: ['contentManager', 'folderView'],
			});
		};
		window.addEventListener(DESKTOP_ITEMS_REFRESH_EVENT, onRefresh);
		window.addEventListener(CONTENT_MANAGER_LIBRARY_REFRESH_EVENT, onRefresh);
		return () => {
			window.removeEventListener(DESKTOP_ITEMS_REFRESH_EVENT, onRefresh);
			window.removeEventListener(
				CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
				onRefresh
			);
		};
	}, [enabled, queryClient]);

	const setFiles = useCallback(
		(
			next: ContentItem[] | ((current: ContentItem[]) => ContentItem[])
		): void => {
			queryClient.setQueryData<FolderViewResult>(queryKey, (current) => {
				if (!current) return current;
				const items =
					typeof next === 'function' ? next(current.files.items) : next;
				return {
					...current,
					files: { ...current.files, items },
				};
			});
		},
		[queryClient, queryKey]
	);

	const setTotal = useCallback(
		(next: number | ((current: number) => number)): void => {
			queryClient.setQueryData<FolderViewResult>(queryKey, (current) => {
				if (!current) return current;
				const total =
					typeof next === 'function' ? next(current.files.total) : next;
				return {
					...current,
					files: { ...current.files, total },
				};
			});
		},
		[queryClient, queryKey]
	);

	const data =
		folderQuery.data ??
		queryClient.getQueryData<FolderViewResult>(queryKey) ??
		null;
	const errorMessage = folderQuery.isError
		? toContentError(folderQuery.error, 'Не удалось загрузить содержимое папки')
		: null;
	const isFetching =
		folderQuery.isFetching || queryClient.isFetching({ queryKey }) > 0;

	return {
		data,
		files: data?.files.items ?? [],
		total: data?.files.total ?? 0,
		desktopChildren: data?.desktop_children ?? [],
		loading: Boolean(enabled && isFetching && !data),
		error: errorMessage,
		refetch,
		setFiles,
		setTotal,
	};
}
