/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads Unified Content rows for Content Manager file lists, including paginated and all-files modes.
 *
 * Invariants:
 * - List requests stay scoped by the caller-provided filters and authenticated backend ACLs.
 * - All-files aggregation is capped and reports truncation to avoid silent unbounded client memory growth.
 *
 * Related:
 * - `contentListAggregation.ts`
 * - `documentation/product/CONTENT-MANAGER.md`
 */
import axios from 'axios';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	contentApi,
	type ContentListQuery,
	type ContentSearchResult,
	getContentCollectionStatus,
	toContentError,
} from '../../../services/contentApi';
import { aggregateContentListPages } from './contentListAggregation';
import type { ContentSearchMode } from './useContentManagerFilesFilters';
import { resolveContentManagerApiFilter } from '../utils/contentManagerApiFilter';

export interface ContentListResponse {
	items: ContentItem[];
	total: number;
}

/** Structured last fetch failure for hints, logging, and recovery (not thrown). */
export interface ContentListFetchFailure {
	message: string;
	cause: unknown;
}

export const FILES_PAGE_SIZE = 50;

interface UseContentListParams {
	filterFolderId: string | null;
	/** When true, request only content with folder_item_id IS NULL. */
	folderUnassignedOnly?: boolean;
	filterCompanyId: string | null;
	filterProjectId: string | null;
	currentPage: number;
	debouncedSearchQuery: string;
	searchMode?: ContentSearchMode;
	filterType: string;
	filterVisibility: 'all' | 'private' | 'shared' | 'friends' | 'from_friends';
	filterTag?: string | null;
	sortField:
		| 'name'
		| 'created_at'
		| 'updated_at'
		| 'file_size'
		| 'content_type';
	sortOrder: 'asc' | 'desc';
	/** Load every page (chunked) into memory — for «Все файлы» without global pagination. */
	aggregateAllPages?: boolean;
	/** Disable this legacy list path when an owning surface uses another read contract. */
	enabled?: boolean;
	onFetchError?: (error: unknown) => void;
	/** Minimum file_size in bytes (server-side GET /content filter). */
	minFileSize?: number | null;
	/** processing_status filter (server-side). */
	processingStatus?: string | null;
}

type ListState = {
	items: ContentItem[];
	totalItems: number;
	loading: boolean;
	error: string | null;
	fetchFailure: ContentListFetchFailure | null;
	aggregateTruncated: boolean;
};

const initialListState = (): ListState => ({
	items: [],
	totalItems: 0,
	loading: true,
	error: null,
	fetchFailure: null,
	aggregateTruncated: false,
});

type ListAction =
	| { type: 'fetch_start' }
	| {
			type: 'fetch_success';
			items: ContentItem[];
			totalItems: number;
			aggregateTruncated?: boolean;
	  }
	| {
			type: 'fetch_error';
			message: string;
			cause: unknown;
	  }
	| {
			type: 'set_items';
			payload: ContentItem[] | ((prev: ContentItem[]) => ContentItem[]);
	  }
	| { type: 'set_total'; payload: number | ((prev: number) => number) };

function listReducer(state: ListState, action: ListAction): ListState {
	switch (action.type) {
		case 'fetch_start':
			return {
				...state,
				loading: true,
				error: null,
				fetchFailure: null,
				aggregateTruncated: false,
				// Keep previous items while refetching (keepPreviousData-like snappiness).
			};
		case 'fetch_success':
			return {
				...state,
				items: action.items,
				totalItems: action.totalItems,
				loading: false,
				error: null,
				fetchFailure: null,
				aggregateTruncated: action.aggregateTruncated ?? false,
			};
		case 'fetch_error':
			return {
				...state,
				loading: false,
				error: action.message,
				fetchFailure: { message: action.message, cause: action.cause },
				aggregateTruncated: false,
			};
		case 'set_items': {
			const next =
				typeof action.payload === 'function'
					? action.payload(state.items)
					: action.payload;
			return { ...state, items: next };
		}
		case 'set_total': {
			const next =
				typeof action.payload === 'function'
					? action.payload(state.totalItems)
					: action.payload;
			return { ...state, totalItems: next };
		}
		default:
			return state;
	}
}

function isAbortLike(error: unknown, signal: AbortSignal): boolean {
	if (signal.aborted) return true;
	if (axios.isCancel(error)) return true;
	if (error instanceof DOMException && error.name === 'AbortError') return true;
	const code =
		error && typeof error === 'object' && 'code' in error
			? (error as { code?: string }).code
			: undefined;
	return code === 'ERR_CANCELED';
}

function searchHitToContentItem(hit: ContentSearchResult): ContentItem {
	return {
		id: hit.id,
		name: hit.name,
		content_type: hit.content_type,
		file_size: null,
		mime_type: null,
		created_at: hit.created_at,
		updated_at: hit.created_at,
		user_id: '',
		visibility: 'private',
		tags: hit.tags,
		description: hit.description ?? null,
	};
}

export function useContentList(params: UseContentListParams) {
	const {
		filterFolderId,
		folderUnassignedOnly = false,
		filterCompanyId,
		filterProjectId,
		currentPage,
		debouncedSearchQuery,
		searchMode = 'keyword',
		filterType,
		filterVisibility,
		filterTag = null,
		sortField,
		sortOrder,
		aggregateAllPages = false,
		enabled = true,
		onFetchError,
		minFileSize = null,
		processingStatus = null,
	} = params;

	const [state, dispatch] = useReducer(
		listReducer,
		undefined,
		initialListState
	);
	const {
		items,
		totalItems,
		loading,
		error,
		fetchFailure,
		aggregateTruncated,
	} = state;

	const requestRef = useRef<AbortController | null>(null);
	const requestIdRef = useRef(0);

	const fetchContent = useCallback(async () => {
		if (!enabled) return;
		requestRef.current?.abort();
		const requestId = ++requestIdRef.current;
		const controller = new AbortController();
		requestRef.current = controller;

		dispatch({ type: 'fetch_start' });

		try {
			const searchActive =
				Boolean(debouncedSearchQuery) && debouncedSearchQuery.trim() !== '';
			if (searchActive && searchMode === 'hybrid' && !aggregateAllPages) {
				const offset = (currentPage - 1) * FILES_PAGE_SIZE;
				const apiFilter = resolveContentManagerApiFilter(filterType);
				const response = await contentApi.searchContent(
					debouncedSearchQuery.trim(),
					{
						signal: controller.signal,
						limit: FILES_PAGE_SIZE,
						offset,
						mode: 'hybrid',
						content_type: apiFilter.content_type,
					}
				);
				if (requestId !== requestIdRef.current) return;
				const nextItems = response.results.map(searchHitToContentItem);
				dispatch({
					type: 'fetch_success',
					items: nextItems,
					totalItems: response.total,
				});
				return;
			}

			const buildQuery = (limit: number, offset: number): ContentListQuery => {
				const queryParams: ContentListQuery = {
					limit,
					offset,
					list_profile: 'compact',
				};
				if (folderUnassignedOnly) {
					queryParams.folder_unassigned = true;
				} else if (filterFolderId != null && filterFolderId !== '') {
					queryParams.folder_item_id = filterFolderId;
				}
				const searchActive =
					Boolean(debouncedSearchQuery) && debouncedSearchQuery.trim() !== '';
				if (!searchActive) {
					if (filterCompanyId != null && filterCompanyId !== '')
						queryParams.company_id = filterCompanyId;
					if (filterProjectId != null && filterProjectId !== '')
						queryParams.project_id = filterProjectId;
				}
				if (searchActive) queryParams.search = debouncedSearchQuery.trim();
				if (filterTag?.trim()) queryParams.tags = filterTag.trim();
				Object.assign(queryParams, resolveContentManagerApiFilter(filterType));
				if (filterVisibility !== 'all')
					queryParams.visibility = filterVisibility;
				const sortFieldMap = {
					name: 'name',
					created_at: 'date',
					updated_at: 'modified',
					file_size: 'size',
					content_type: 'type',
				} as const;
				queryParams.sort_field = sortFieldMap[sortField] ?? 'modified';
				queryParams.sort_order = sortOrder;
				if (minFileSize != null && minFileSize >= 0) {
					queryParams.min_file_size = minFileSize;
				}
				const statusFilter = processingStatus?.trim();
				if (statusFilter) {
					queryParams.processing_status = statusFilter.toLowerCase();
				}
				return queryParams;
			};

			if (aggregateAllPages) {
				const aggregated = await aggregateContentListPages({
					buildQuery,
					fetchPage: (query) =>
						contentApi.listContent(query, { signal: controller.signal }),
					isCurrent: () => requestId === requestIdRef.current,
				});
				if (!aggregated) return;
				dispatch({
					type: 'fetch_success',
					items: aggregated.items,
					totalItems: aggregated.total,
					aggregateTruncated: aggregated.truncated,
				});
			} else {
				const offset = (currentPage - 1) * FILES_PAGE_SIZE;
				const response = await contentApi.listContent(
					buildQuery(FILES_PAGE_SIZE, offset),
					{ signal: controller.signal }
				);
				if (requestId !== requestIdRef.current) return;
				const nextItems = response.items || [];
				const nextTotal =
					typeof response.total === 'number'
						? response.total
						: (nextItems.length ?? 0);
				dispatch({
					type: 'fetch_success',
					items: nextItems,
					totalItems: nextTotal,
				});
			}
		} catch (err) {
			if (requestId !== requestIdRef.current) return;
			if (isAbortLike(err, controller.signal)) return;
			const errorMessage = toContentError(
				err,
				'Не удалось загрузить список контента'
			);
			dispatch({ type: 'fetch_error', message: errorMessage, cause: err });
			onFetchError?.(err);
		}
	}, [
		aggregateAllPages,
		currentPage,
		debouncedSearchQuery,
		enabled,
		searchMode,
		filterFolderId,
		folderUnassignedOnly,
		filterCompanyId,
		filterProjectId,
		filterTag,
		filterType,
		filterVisibility,
		onFetchError,
		sortField,
		sortOrder,
		minFileSize,
		processingStatus,
	]);

	useEffect(() => () => requestRef.current?.abort(), []);

	const status = getContentCollectionStatus(items, loading, error);

	const isRefreshing = loading && items.length > 0;
	const isInitialLoading = loading && items.length === 0;

	const setItems = useCallback(
		(next: ContentItem[] | ((prev: ContentItem[]) => ContentItem[])) => {
			dispatch({ type: 'set_items', payload: next });
		},
		[]
	);

	const setTotalItems = useCallback(
		(next: number | ((prev: number) => number)) => {
			dispatch({ type: 'set_total', payload: next });
		},
		[]
	);

	const listStateSlice = useMemo(
		() => ({ items, totalItems, loading, error, fetchFailure }),
		[items, totalItems, loading, error, fetchFailure]
	);

	return {
		...listStateSlice,
		setItems,
		setTotalItems,
		isEmpty: status === 'empty',
		status,
		isRefreshing,
		isInitialLoading,
		isAggregateTruncated: aggregateTruncated,
		fetchContent,
	};
}
