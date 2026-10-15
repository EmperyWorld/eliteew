/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Music Player catalog pagination, request race cancellation, refresh events, and list loading refs.
 *
 * Invariants:
 * - Only the latest list request may update catalog state.
 * - Pagination observer never starts a duplicate load while reset/load-more is active.
 * - Full library hydration remains lazy and starts when Music Player opens.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/Desktop/context/MusicLibraryContext.tsx
 */

import { CONTENT_MANAGER_LIBRARY_REFRESH_EVENT } from '@/services/unifiedContentEvents';
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import type { Content } from '../../components/UnifiedContent/types';
import { api } from '../../services/api/client';
import { SYSTEM_FOLDER_ITEM } from '../ContentManager/sortToSystemFolders';
import type {
	ContentListResponse,
	FilterMode,
	TrackSortField,
	TrackSortOrder,
} from './musicPlayerTypes';
import {
	DEFAULT_TRACK_SORT_FIELD,
	DEFAULT_TRACK_SORT_ORDER,
	PAGE_SIZE,
} from './musicPlayerTypes';
import { isAbortOrCancelError } from './musicPlayerUtils';

export interface UseMusicPlayerCatalogOptions {
	ensureCatalogLoaded: () => Promise<void>;
	loadListFallbackMessage: string;
}

export function useMusicPlayerCatalog({
	ensureCatalogLoaded,
	loadListFallbackMessage,
}: UseMusicPlayerCatalogOptions) {
	const [filterMode, setFilterMode] = useState<FilterMode>('all');
	const [sortField, setSortField] = useState<TrackSortField>(
		DEFAULT_TRACK_SORT_FIELD
	);
	const [sortOrder, setSortOrder] = useState<TrackSortOrder>(
		DEFAULT_TRACK_SORT_ORDER
	);
	const [tracks, setTracks] = useState<Content[]>([]);
	const [, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [nextOffset, setNextOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [catalogResetVersion, setCatalogResetVersion] = useState(0);

	const trackListScrollRef = useRef<HTMLDivElement>(null);
	const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
	const listFetchAbortRef = useRef<AbortController | null>(null);
	const listFetchFlightRef = useRef(0);
	const nextOffsetRef = useRef(0);
	const hasMoreRef = useRef(hasMore);
	const isLoadingMoreRef = useRef(isLoadingMore);
	const loadingRef = useRef(loading);

	useEffect(() => {
		void ensureCatalogLoaded();
	}, [ensureCatalogLoaded]);

	useEffect(() => {
		nextOffsetRef.current = nextOffset;
	}, [nextOffset]);

	useEffect(() => {
		hasMoreRef.current = hasMore;
	}, [hasMore]);

	useEffect(() => {
		isLoadingMoreRef.current = isLoadingMore;
	}, [isLoadingMore]);

	useEffect(() => {
		loadingRef.current = loading;
	}, [loading]);

	useEffect(() => {
		return () => {
			listFetchFlightRef.current += 1;
			listFetchAbortRef.current?.abort();
		};
	}, []);

	const fetchTracks = useCallback(
		async (reset: boolean) => {
			listFetchFlightRef.current += 1;
			const flight = listFetchFlightRef.current;
			listFetchAbortRef.current?.abort();
			const controller = new AbortController();
			listFetchAbortRef.current = controller;

			if (reset) {
				setLoading(true);
			} else {
				setIsLoadingMore(true);
			}
			setError(null);

			try {
				const offset = reset ? 0 : nextOffsetRef.current;
				const apiSortField =
					sortField === 'duration' || sortField === 'updated'
						? 'name'
						: sortField;
				const params: Record<string, string | number> = {
					content_type: 'audio',
					limit: PAGE_SIZE,
					offset,
					sort_field: apiSortField,
					sort_order: sortOrder,
				};
				if (filterMode === 'music') {
					params.folder_item_id = 'music';
				} else {
					params.exclude_folder_item_id = SYSTEM_FOLDER_ITEM.projects;
				}

				const response = await api.get<ContentListResponse>('/content', {
					baseURL: '/api/v1',
					params,
					signal: controller.signal,
				});
				if (flight !== listFetchFlightRef.current) return;

				const items = response.items ?? [];
				const totalFromResponse =
					typeof response.total === 'number' ? response.total : items.length;
				setTotal(totalFromResponse);
				setTracks((previous) => (reset ? items : [...previous, ...items]));
				if (reset) {
					setCatalogResetVersion((version) => version + 1);
				}

				const newOffset = offset + items.length;
				setNextOffset(newOffset);
				setHasMore(newOffset < totalFromResponse);
			} catch (requestError) {
				if (flight !== listFetchFlightRef.current) return;
				if (isAbortOrCancelError(requestError)) return;
				setError(
					requestError instanceof Error
						? requestError.message
						: loadListFallbackMessage
				);
				if (reset) {
					setTracks([]);
					setTotal(0);
					setHasMore(false);
					setNextOffset(0);
					setCatalogResetVersion((version) => version + 1);
				}
			} finally {
				if (flight === listFetchFlightRef.current) {
					if (reset) {
						setLoading(false);
					} else {
						setIsLoadingMore(false);
					}
				}
			}
		},
		[filterMode, loadListFallbackMessage, sortField, sortOrder]
	);

	useEffect(() => {
		void fetchTracks(true);
	}, [fetchTracks]);

	useEffect(() => {
		const onLibraryRefresh = () => {
			void fetchTracks(true);
		};
		window.addEventListener(
			CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
			onLibraryRefresh
		);
		return () => {
			window.removeEventListener(
				CONTENT_MANAGER_LIBRARY_REFRESH_EVENT,
				onLibraryRefresh
			);
		};
	}, [fetchTracks]);

	const loadMoreTracks = useCallback(() => {
		void fetchTracks(false);
	}, [fetchTracks]);

	useEffect(() => {
		if (!hasMore || loading) return;
		const root = trackListScrollRef.current;
		const target = loadMoreSentinelRef.current;
		if (!root || !target) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (!entry?.isIntersecting) return;
				if (
					!hasMoreRef.current ||
					loadingRef.current ||
					isLoadingMoreRef.current
				) {
					return;
				}
				loadMoreTracks();
			},
			{ root, rootMargin: '400px 0px', threshold: 0 }
		);
		observer.observe(target);
		return () => observer.disconnect();
	}, [hasMore, loading, loadMoreTracks]);

	const selectFilterMusic = useCallback(() => {
		startTransition(() => setFilterMode('music'));
	}, []);

	const selectFilterAll = useCallback(() => {
		startTransition(() => setFilterMode('all'));
	}, []);

	const onSortFieldName = useCallback(() => {
		startTransition(() => setSortField('name'));
	}, []);

	const onSortFieldDate = useCallback(() => {
		startTransition(() => setSortField('date'));
	}, []);

	const onSortFieldDuration = useCallback(() => {
		startTransition(() => setSortField('duration'));
	}, []);

	const onSortFieldUpdated = useCallback(() => {
		startTransition(() => setSortField('updated'));
	}, []);

	const onToggleSortOrder = useCallback(() => {
		startTransition(() =>
			setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
		);
	}, []);

	return {
		filterMode,
		sortField,
		sortOrder,
		tracks,
		setTracks,
		setTotal,
		loading,
		error,
		isLoadingMore,
		hasMore,
		catalogResetVersion,
		trackListScrollRef,
		loadMoreSentinelRef,
		fetchTracks,
		loadMoreTracks,
		selectFilterMusic,
		selectFilterAll,
		onSortFieldName,
		onSortFieldDate,
		onSortFieldDuration,
		onSortFieldUpdated,
		onToggleSortOrder,
	};
}
