/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cursor-paged Unified Content reads for Content Manager «Все файлы» mode.
 *
 * Invariants:
 * - Loads one server page at a time and appends via `next_cursor`; no client 10k aggregation cap.
 * - Filter/sort changes reset the cursor chain and replace the in-memory list.
 *
 * Related:
 * - `useContentList.ts`
 * - `useContentManagerContentListOrchestration.ts`
 * - `documentation/product/CONTENT-MANAGER.md`
 */
import axios from 'axios';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	contentApi,
	type ContentListQuery,
	getContentCollectionStatus,
	toContentError,
} from '../../../services/contentApi';
import type { ContentSearchMode } from './useContentManagerFilesFilters';
import { resolveContentManagerApiFilter } from '../utils/contentManagerApiFilter';

/** Server max for GET /content (`le=200`). */
export const ALL_FILES_LIST_PAGE_SIZE = 200;

export interface ContentManagerAllFilesQueryParams {
	filterCompanyId: string | null;
	filterProjectId: string | null;
	debouncedSearchQuery: string;
	searchMode?: ContentSearchMode;
	filterType: string;
	filterVisibility: 'all' | 'private' | 'shared' | 'friends' | 'from_friends';
	sortField:
		| 'name'
		| 'created_at'
		| 'updated_at'
		| 'file_size'
		| 'content_type';
	sortOrder: 'asc' | 'desc';
	enabled?: boolean;
	onFetchError?: (error: unknown) => void;
	/** Minimum file_size in bytes (server-side). */
	minFileSize?: number | null;
	/** processing_status filter (server-side). */
	processingStatus?: string | null;
}

type AllFilesState = {
	items: ContentItem[];
	totalItems: number;
	loading: boolean;
	loadingMore: boolean;
	error: string | null;
	nextCursor: string | null;
	hasMore: boolean;
};

const initialState = (): AllFilesState => ({
	items: [],
	totalItems: 0,
	loading: true,
	loadingMore: false,
	error: null,
	nextCursor: null,
	hasMore: false,
});

type AllFilesAction =
	| { type: 'fetch_start'; append: boolean }
	| {
			type: 'fetch_success';
			append: boolean;
			items: ContentItem[];
			totalItems: number;
			nextCursor: string | null;
			hasMore: boolean;
	  }
	| { type: 'fetch_error'; message: string }
	| {
			type: 'set_items';
			payload: ContentItem[] | ((prev: ContentItem[]) => ContentItem[]);
	  }
	| { type: 'set_total'; payload: number | ((prev: number) => number) };

function reducer(state: AllFilesState, action: AllFilesAction): AllFilesState {
	switch (action.type) {
		case 'fetch_start':
			return {
				...state,
				loading: !action.append,
				loadingMore: action.append,
				error: null,
				...(action.append ? {} : { nextCursor: null, hasMore: false }),
			};
		case 'fetch_success':
			return {
				...state,
				items: action.append
					? mergeAllFilesItems(state.items, action.items)
					: action.items,
				totalItems: action.totalItems,
				loading: false,
				loadingMore: false,
				error: null,
				nextCursor: action.nextCursor,
				hasMore: action.hasMore,
			};
		case 'fetch_error':
			return {
				...state,
				loading: false,
				loadingMore: false,
				error: action.message,
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

function mergeAllFilesItems(
	existing: ContentItem[],
	incoming: ContentItem[]
): ContentItem[] {
	if (incoming.length === 0) return existing;
	const seen = new Set(existing.map((row) => row.id));
	const appended = incoming.filter((row) => !seen.has(row.id));
	return appended.length ? [...existing, ...appended] : existing;
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

function buildAllFilesListQuery(
	params: Pick<
		ContentManagerAllFilesQueryParams,
		| 'filterCompanyId'
		| 'filterProjectId'
		| 'debouncedSearchQuery'
		| 'filterType'
		| 'filterVisibility'
		| 'sortField'
		| 'sortOrder'
		| 'minFileSize'
		| 'processingStatus'
	>,
	cursor?: string | null
): ContentListQuery {
	const query: ContentListQuery = {
		limit: ALL_FILES_LIST_PAGE_SIZE,
		offset: 0,
		list_profile: 'compact',
	};
	if (cursor) query.cursor = cursor;
	const searchActive =
		Boolean(params.debouncedSearchQuery) &&
		params.debouncedSearchQuery.trim() !== '';
	if (!searchActive) {
		if (params.filterCompanyId != null && params.filterCompanyId !== '') {
			query.company_id = params.filterCompanyId;
		}
		if (params.filterProjectId != null && params.filterProjectId !== '') {
			query.project_id = params.filterProjectId;
		}
	}
	if (searchActive) query.search = params.debouncedSearchQuery.trim();
	Object.assign(query, resolveContentManagerApiFilter(params.filterType));
	if (params.filterVisibility !== 'all') {
		query.visibility = params.filterVisibility;
	}
	const sortFieldMap = {
		name: 'name',
		created_at: 'date',
		updated_at: 'modified',
		file_size: 'size',
		content_type: 'type',
	} as const;
	query.sort_field = sortFieldMap[params.sortField] ?? 'modified';
	query.sort_order = params.sortOrder;
	if (params.minFileSize != null && params.minFileSize >= 0) {
		query.min_file_size = params.minFileSize;
	}
	const statusFilter = params.processingStatus?.trim();
	if (statusFilter) {
		query.processing_status = statusFilter.toLowerCase();
	}
	return query;
}

export function useContentManagerAllFilesQuery(
	params: ContentManagerAllFilesQueryParams
) {
	const {
		filterCompanyId,
		filterProjectId,
		debouncedSearchQuery,
		searchMode = 'keyword',
		filterType,
		filterVisibility,
		sortField,
		sortOrder,
		enabled = true,
		onFetchError,
		minFileSize = null,
		processingStatus = null,
	} = params;

	const [state, dispatch] = useReducer(reducer, undefined, initialState);
	const requestRef = useRef<AbortController | null>(null);
	const requestIdRef = useRef(0);
	const itemsLengthRef = useRef(0);
	itemsLengthRef.current = state.items.length;

	const fetchPage = useCallback(
		async (append: boolean, cursor?: string | null) => {
			if (!enabled) return;
			requestRef.current?.abort();
			const requestId = ++requestIdRef.current;
			const controller = new AbortController();
			requestRef.current = controller;
			dispatch({ type: 'fetch_start', append });

			try {
				const searchActive =
					Boolean(debouncedSearchQuery) && debouncedSearchQuery.trim() !== '';
				if (searchActive && searchMode === 'hybrid') {
					const offset = append ? itemsLengthRef.current : 0;
					const apiFilter = resolveContentManagerApiFilter(filterType);
					const response = await contentApi.searchContent(
						debouncedSearchQuery.trim(),
						{
							signal: controller.signal,
							limit: ALL_FILES_LIST_PAGE_SIZE,
							offset,
							mode: 'hybrid',
							content_type: apiFilter.content_type,
						}
					);
					if (requestId !== requestIdRef.current) return;
					const mapped = response.results.map((hit) => ({
						id: hit.id,
						name: hit.name,
						content_type: hit.content_type,
						file_size: null,
						mime_type: null,
						created_at: hit.created_at,
						updated_at: hit.created_at,
						user_id: '',
						visibility: 'private' as const,
						tags: hit.tags,
						description: hit.description ?? null,
					}));
					const loadedAfter = append
						? itemsLengthRef.current + mapped.length
						: mapped.length;
					dispatch({
						type: 'fetch_success',
						append,
						items: mapped,
						totalItems: response.total,
						nextCursor: null,
						hasMore: loadedAfter < response.total,
					});
					return;
				}

				const response = await contentApi.listContent(
					buildAllFilesListQuery(
						{
							filterCompanyId,
							filterProjectId,
							debouncedSearchQuery,
							filterType,
							filterVisibility,
							sortField,
							sortOrder,
							minFileSize,
							processingStatus,
						},
						cursor
					),
					{ signal: controller.signal }
				);
				if (requestId !== requestIdRef.current) return;
				const batch = response.items ?? [];
				const total =
					typeof response.total === 'number' ? response.total : batch.length;
				const nextCursor = response.next_cursor ?? null;
				const hasMore =
					response.has_more === true ||
					Boolean(nextCursor) ||
					(!nextCursor &&
						!searchActive &&
						batch.length === ALL_FILES_LIST_PAGE_SIZE &&
						(append ? itemsLengthRef.current + batch.length : batch.length) <
							total);
				dispatch({
					type: 'fetch_success',
					append,
					items: batch,
					totalItems: total,
					nextCursor,
					hasMore,
				});
			} catch (err) {
				if (requestId !== requestIdRef.current) return;
				if (isAbortLike(err, controller.signal)) return;
				const errorMessage = toContentError(
					err,
					'Не удалось загрузить список контента'
				);
				dispatch({ type: 'fetch_error', message: errorMessage });
				onFetchError?.(err);
			}
		},
		[
			debouncedSearchQuery,
			enabled,
			filterCompanyId,
			filterProjectId,
			filterType,
			filterVisibility,
			minFileSize,
			onFetchError,
			processingStatus,
			searchMode,
			sortField,
			sortOrder,
		]
	);

	const refresh = useCallback(async () => {
		await fetchPage(false, null);
	}, [fetchPage]);

	const loadMore = useCallback(async () => {
		if (!state.hasMore || state.loading || state.loadingMore) return;
		if (state.nextCursor) {
			await fetchPage(true, state.nextCursor);
			return;
		}
		if (debouncedSearchQuery.trim() && searchMode === 'hybrid') {
			await fetchPage(true, null);
		}
	}, [
		debouncedSearchQuery,
		fetchPage,
		searchMode,
		state.hasMore,
		state.loading,
		state.loadingMore,
		state.nextCursor,
	]);

	useEffect(() => () => requestRef.current?.abort(), []);

	useEffect(() => {
		if (!enabled) return;
		void fetchPage(false, null);
	}, [enabled, fetchPage]);

	const status = getContentCollectionStatus(
		state.items,
		state.loading,
		state.error
	);

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

	return {
		items: state.items,
		totalItems: state.totalItems,
		loading: state.loading,
		loadingMore: state.loadingMore,
		error: state.error,
		hasMore: state.hasMore,
		loadedCount: state.items.length,
		setItems,
		setTotalItems,
		isEmpty: status === 'empty',
		status,
		isRefreshing: state.loading && state.items.length > 0,
		isInitialLoading: state.loading && state.items.length === 0,
		fetchContent: refresh,
		loadMore,
	};
}
