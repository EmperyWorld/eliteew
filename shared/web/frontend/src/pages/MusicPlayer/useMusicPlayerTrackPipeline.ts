/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Music Player search/tag/origin/playlist projection, playlist row hydration, and browse override wiring.
 *
 * Invariants:
 * - Playlist hydration is race-safe and never prunes shell playlist ids on request failure.
 * - Browse override is cleared when the Music Player page unmounts.
 * - Deferred search keeps input updates responsive while filtering large catalogs.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerPlaylistHydration.ts
 * - src/pages/Desktop/context/MusicPlaybackDomainContext.tsx
 */

import type { TFunction } from 'i18next';
import {
	startTransition,
	type ChangeEvent,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { Content } from '../../components/UnifiedContent/types';
import { api } from '../../services/api/client';
import type { MusicDomainTrack } from '../Desktop/context/MusicPlaybackDomainContext';
import {
	persistMusicPlayerPreference,
	readTrackOriginFilter,
	TRACK_ORIGIN_FILTER_STORAGE_KEY,
} from './musicPlayerPageConstants';
import { resolveMusicPlayerEmptyStateKind } from './musicPlayerEmptyState';
import { compareMusicPlayerTrackNames } from './musicPlayerLocale';
import {
	chunkIds,
	mergeHydratedPlaylistTracks,
	missingPlaylistTrackIds,
	orderTracksByPlaylistIds,
} from './musicPlayerPlaylistHydration';
import { resolveMusicPlayerPlaylistDisplayName } from './musicPlayerPlaylistDisplay';
import { formatMusicPlayerPresentationGapsBanner } from './musicPlayerPresentationGaps';
import type {
	FilterMode,
	SavedPlaylist,
	TrackOriginFilter,
	TrackSortField,
	TrackSortOrder,
} from './musicPlayerTypes';
import {
	filterTracksByOrigin,
	isAbortOrCancelError,
	summarizeDurationSortGaps,
	summarizeTrackPresentationGaps,
	trackDurationSeconds,
} from './musicPlayerUtils';

export interface UseMusicPlayerTrackPipelineOptions {
	tracks: Content[];
	setTracks: Dispatch<SetStateAction<Content[]>>;
	catalogResetVersion: number;
	filterMode: FilterMode;
	sortField: TrackSortField;
	sortOrder: TrackSortOrder;
	playlists: SavedPlaylist[];
	favoritesPlaylistTrackCount: number;
	queue: MusicDomainTrack[];
	enqueue: (track: MusicDomainTrack) => void;
	setPlayerPlaybackBrowseOverride: (tracks: MusicDomainTrack[] | null) => void;
	musicPlayerLocale: string;
	t: TFunction<'desktopUi'>;
}

export function useMusicPlayerTrackPipeline({
	tracks,
	setTracks,
	catalogResetVersion,
	filterMode,
	sortField,
	sortOrder,
	playlists,
	favoritesPlaylistTrackCount,
	queue,
	enqueue,
	setPlayerPlaybackBrowseOverride,
	musicPlayerLocale,
	t,
}: UseMusicPlayerTrackPipelineOptions) {
	const [searchQuery, setSearchQuery] = useState('');
	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [originFilter, setOriginFilter] = useState<TrackOriginFilter>(
		readTrackOriginFilter
	);
	const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(
		null
	);
	const playlistHydrationAttemptRef = useRef('');

	useEffect(() => {
		persistMusicPlayerPreference(TRACK_ORIGIN_FILTER_STORAGE_KEY, originFilter);
	}, [originFilter]);

	const onSearchInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSearchQuery(event.target.value);
		},
		[]
	);

	const clearSearchQuery = useCallback(() => {
		startTransition(() => setSearchQuery(''));
	}, []);

	const onClearActiveTag = useCallback(() => {
		startTransition(() => setActiveTag(null));
	}, []);

	const onTagClick = useCallback((tag: string) => {
		startTransition(() =>
			setActiveTag((current) => (current === tag ? null : tag))
		);
	}, []);

	const onPlaylistPickerChange = useCallback((id: string | null) => {
		startTransition(() => setCurrentPlaylistId(id));
	}, []);

	const clearPlaylistSelection = useCallback(() => {
		startTransition(() => setCurrentPlaylistId(null));
	}, []);

	const onOriginFilterChange = useCallback((next: TrackOriginFilter) => {
		startTransition(() => setOriginFilter(next));
	}, []);

	const clearOriginFilter = useCallback(() => {
		startTransition(() => setOriginFilter('all'));
	}, []);

	const deferredSearchQuery = useDeferredValue(searchQuery);
	const deferredFilterQuery = deferredSearchQuery.trim().toLowerCase();
	const isSearchFilterPending =
		searchQuery.trim() !== deferredSearchQuery.trim();

	const popularTags = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const item of tracks) {
			if (!Array.isArray(item.tags)) continue;
			for (const rawTag of item.tags) {
				const tag = rawTag.trim();
				if (!tag) continue;
				counts[tag] = (counts[tag] ?? 0) + 1;
			}
		}
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 24)
			.map(([tag]) => tag);
	}, [tracks]);

	const currentPlaylistEntry = useMemo(() => {
		if (!currentPlaylistId) return null;
		return (
			playlists.find((playlist) => playlist.id === currentPlaylistId) ?? null
		);
	}, [currentPlaylistId, playlists]);

	const playlistTrackIdsSet = useMemo((): Set<string> | null => {
		if (!currentPlaylistEntry) return null;
		return new Set(currentPlaylistEntry.trackIds);
	}, [currentPlaylistEntry]);

	const tracksById = useMemo(
		() => new Map(tracks.map((track) => [track.id, track])),
		[tracks]
	);

	useEffect(() => {
		if (!currentPlaylistEntry) {
			playlistHydrationAttemptRef.current = '';
			return;
		}
		const loadedIds = new Set(tracks.map((track) => track.id));
		const missing = missingPlaylistTrackIds(
			currentPlaylistEntry.trackIds,
			loadedIds
		);
		if (missing.length === 0) return;

		const attemptKey = `${catalogResetVersion}:${currentPlaylistEntry.id}:${missing
			.slice()
			.sort()
			.join(',')}`;
		if (playlistHydrationAttemptRef.current === attemptKey) return;
		playlistHydrationAttemptRef.current = attemptKey;

		let cancelled = false;
		const flightController = new AbortController();

		void (async () => {
			const hydrated: Content[] = [];
			for (const chunk of chunkIds(missing)) {
				if (cancelled) return;
				try {
					const batch = await api.get<Record<string, Content>>(
						'/content/batch',
						{
							baseURL: '/api/v1',
							params: { ids: chunk.join(',') },
							signal: flightController.signal,
						}
					);
					if (!batch || typeof batch !== 'object') continue;
					for (const row of Object.values(batch)) {
						if (
							row &&
							typeof row === 'object' &&
							typeof row.id === 'string' &&
							row.id.trim()
						) {
							hydrated.push(row);
						}
					}
				} catch (error) {
					if (isAbortOrCancelError(error) || cancelled) return;
					// Keep shell favorites intact and render the rows already available.
					break;
				}
			}
			if (cancelled || hydrated.length === 0) return;
			setTracks((previous) => mergeHydratedPlaylistTracks(previous, hydrated));
		})();

		return () => {
			cancelled = true;
			flightController.abort();
		};
	}, [catalogResetVersion, currentPlaylistEntry, setTracks, tracks]);

	const currentPlaylistDetails = useMemo(() => {
		if (!currentPlaylistEntry) return null;
		let totalDurationSeconds = 0;
		let hasAnyDuration = false;
		for (const trackId of currentPlaylistEntry.trackIds) {
			const track = tracksById.get(trackId);
			if (!track) continue;
			const durationSeconds = trackDurationSeconds(track.metadata);
			if (durationSeconds == null || !Number.isFinite(durationSeconds)) {
				continue;
			}
			totalDurationSeconds += durationSeconds;
			hasAnyDuration = true;
		}
		return {
			name: resolveMusicPlayerPlaylistDisplayName(
				currentPlaylistEntry,
				t('musicPlayer.favoritesPlaylist.name')
			),
			trackCount: currentPlaylistEntry.trackIds.length,
			totalDurationSeconds: hasAnyDuration
				? Math.max(0, Math.round(totalDurationSeconds))
				: null,
		};
	}, [currentPlaylistEntry, t, tracksById]);

	const queueTrackIdsSet = useMemo(
		() => new Set(queue.map((item) => item.id)),
		[queue]
	);

	const filteredTracks = useMemo(() => {
		let result = playlistTrackIdsSet
			? orderTracksByPlaylistIds(
					currentPlaylistEntry?.trackIds ?? [],
					tracksById
				)
			: tracks;

		if (deferredFilterQuery) {
			result = result.filter(
				(item) =>
					item.name.toLowerCase().includes(deferredFilterQuery) ||
					(item.mime_type ?? '').toLowerCase().includes(deferredFilterQuery)
			);
		}
		if (activeTag) {
			result = result.filter(
				(item) => Array.isArray(item.tags) && item.tags.includes(activeTag)
			);
		}
		if (originFilter !== 'all') {
			result = filterTracksByOrigin(result, originFilter);
		}

		const withIndex = result.map((item, index) => ({ item, index }));
		withIndex.sort((left, right) => {
			let comparison = 0;
			if (sortField === 'name') {
				comparison = compareMusicPlayerTrackNames(
					left.item.name,
					right.item.name,
					musicPlayerLocale
				);
			} else if (sortField === 'date') {
				const leftTime = new Date(left.item.created_at).getTime() || 0;
				const rightTime = new Date(right.item.created_at).getTime() || 0;
				comparison = leftTime - rightTime;
			} else if (sortField === 'updated') {
				const leftTime = new Date(left.item.updated_at).getTime() || 0;
				const rightTime = new Date(right.item.updated_at).getTime() || 0;
				comparison = leftTime - rightTime;
			} else if (sortField === 'duration') {
				const leftDuration =
					trackDurationSeconds(left.item.metadata) ?? Number.POSITIVE_INFINITY;
				const rightDuration =
					trackDurationSeconds(right.item.metadata) ?? Number.POSITIVE_INFINITY;
				comparison = leftDuration - rightDuration;
			}
			if (comparison === 0) return left.index - right.index;
			return sortOrder === 'asc' ? comparison : -comparison;
		});
		return withIndex.map(({ item }) => item);
	}, [
		activeTag,
		currentPlaylistEntry?.trackIds,
		deferredFilterQuery,
		musicPlayerLocale,
		originFilter,
		playlistTrackIdsSet,
		sortField,
		sortOrder,
		tracks,
		tracksById,
	]);

	const presentationGaps = useMemo(
		() => summarizeTrackPresentationGaps(filteredTracks),
		[filteredTracks]
	);
	const presentationGapsBanner = useMemo(
		() =>
			formatMusicPlayerPresentationGapsBanner(presentationGaps, {
				formatBanner: (details) =>
					t('musicPlayer.presentationGaps.banner', { details }),
				formatWithoutArtwork: (count) =>
					t('musicPlayer.presentationGaps.withoutArtwork', { count }),
				formatWithoutDuration: (count) =>
					t('musicPlayer.presentationGaps.withoutDuration', { count }),
			}),
		[presentationGaps, t]
	);

	const addFilteredTracksToQueue = useCallback(() => {
		for (const track of filteredTracks) {
			enqueue({
				id: track.id,
				name: track.name,
				thumbnail_url: track.thumbnail_url ?? null,
				version: track.file_hash ?? track.updated_at,
			});
		}
	}, [enqueue, filteredTracks]);

	const durationSortGaps = useMemo(
		() => summarizeDurationSortGaps(tracks),
		[tracks]
	);
	const showDurationSortWarning =
		sortField === 'duration' &&
		durationSortGaps.missingDurationCount > 0 &&
		durationSortGaps.totalCount > 0;
	const isFilteredEmptyList =
		tracks.length > 0 &&
		(Boolean(deferredFilterQuery) ||
			Boolean(activeTag) ||
			Boolean(currentPlaylistId) ||
			originFilter !== 'all');
	const emptyStateKind = useMemo(
		() =>
			resolveMusicPlayerEmptyStateKind({
				tracksLength: tracks.length,
				filterMode,
				currentPlaylistId,
				favoritesPlaylistTrackCount,
			}),
		[currentPlaylistId, favoritesPlaylistTrackCount, filterMode, tracks.length]
	);

	useEffect(() => {
		setPlayerPlaybackBrowseOverride(
			filteredTracks.map((item) => ({
				id: item.id,
				name: item.name,
				thumbnail_url: item.thumbnail_url ?? null,
				version: item.file_hash ?? item.updated_at,
			}))
		);
	}, [filteredTracks, setPlayerPlaybackBrowseOverride]);

	useEffect(() => {
		return () => {
			setPlayerPlaybackBrowseOverride(null);
		};
	}, [setPlayerPlaybackBrowseOverride]);

	return {
		searchQuery,
		onSearchInputChange,
		clearSearchQuery,
		deferredFilterQuery,
		isSearchFilterPending,
		activeTag,
		onClearActiveTag,
		onTagClick,
		originFilter,
		onOriginFilterChange,
		clearOriginFilter,
		currentPlaylistId,
		setCurrentPlaylistId,
		onPlaylistPickerChange,
		clearPlaylistSelection,
		popularTags,
		currentPlaylistEntry,
		currentPlaylistDetails,
		queueTrackIdsSet,
		filteredTracks,
		presentationGapsBanner,
		addFilteredTracksToQueue,
		durationSortGaps,
		showDurationSortWarning,
		isFilteredEmptyList,
		emptyStateKind,
	};
}
