/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Music Player master–detail body: catalog scroll, optional stacked queue,
 * wide stage dock, and now-playing footer strip.
 *
 * Invariants:
 * - Wide (≥1100px @container) uses stage dock; narrow keeps stacked queue.
 * - Transport stays authoritative from NowPlaying / MusicPlayback callers.
 *
 * Related:
 * - MusicPlayerPage.tsx, MusicPlayerStageDock.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import type { NowPlayingTransportValue } from '../Desktop/context/NowPlayingContext';
import type { Content } from '../../components/UnifiedContent/types';
import { cn } from '@/lib/utils';
import type {
	Dispatch,
	JSX,
	MouseEvent,
	RefObject,
	SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS,
	MUSIC_PLAYER_MASTER_DETAIL_ROW_CLASS,
	MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS,
	MUSIC_PLAYER_STACKED_QUEUE_WRAP_CLASS,
	MUSIC_PLAYER_TRACK_LIST_SCROLL_CLASS,
} from './musicPlayerChrome';
import type { MusicPlayerEmptyStateKind } from './musicPlayerEmptyState';
import type {
	TrackListDensity,
	TrackListViewMode,
} from './musicPlayerPageConstants';
import { sw } from './musicPlayerPageConstants';
import type { RepeatMode } from './musicPlayerTypes';
import { MusicPlayerEmptyState } from './MusicPlayerEmptyState';
import { MusicPlayerLoadingSkeleton } from './MusicPlayerLoadingSkeleton';
import { MusicPlayerNowPlayingBar } from './MusicPlayerNowPlayingBar';
import { MusicPlayerQueuePanel } from './MusicPlayerQueuePanel';
import {
	MusicPlayerStageDock,
	type MusicPlayerStageDockTrack,
} from './MusicPlayerStageDock';
import { MusicPlayerTrackList } from './MusicPlayerTrackList';

export interface MusicPlayerMasterDetailProps {
	showStageDock: boolean;
	headerStripClass: string;
	queue: Array<{ id: string; name: string; thumbnail_url?: string | null }>;
	onReorderQueue: (fromIndex: number, toIndex: number) => void;
	onMoveQueueItemToTop: (trackId: string) => void;
	onAddCurrentListToQueue: () => void;
	canAddCurrentList: boolean;
	trackListScrollRef: RefObject<HTMLDivElement | null>;
	loadMoreSentinelRef: RefObject<HTMLDivElement | null>;
	presentationGapsBanner: string | null;
	loading: boolean;
	error: string | null;
	onRetryLoad: () => void;
	filteredTracks: Content[];
	emptyStateKind: MusicPlayerEmptyStateKind;
	contentPanelClass: string;
	isFilteredEmptyList: boolean;
	hasSearchQuery: boolean;
	hasActiveTag: boolean;
	hasPlaylistSelection: boolean;
	hasOriginFilter: boolean;
	onClearSearch: () => void;
	onClearActiveTag: () => void;
	onClearPlaylistSelection: () => void;
	onClearOriginFilter: () => void;
	onShowAllMusic: () => void;
	onOpenMusicGenerator: () => void;
	onOpenContentManager: () => void;
	isSearchFilterPending: boolean;
	currentTrackId: string | null;
	errorTrackId: string | null;
	playing: boolean;
	isLoading: boolean;
	onPlayTrack: (item: Content) => void;
	onRowContextMenu: (event: MouseEvent, item: Content) => void;
	favoriteIdsSet: Set<string>;
	onToggleFavorite: (event: MouseEvent, item: Content) => void;
	trackListDensity: TrackListDensity;
	trackListViewMode: TrackListViewMode;
	hasMore: boolean;
	isLoadingMore: boolean;
	onLoadMore: () => void;
	stageDockTrack: MusicPlayerStageDockTrack | null;
	stageDockIsFavorite: boolean;
	onToggleStageFavorite: () => void;
	nowPlaying: NowPlayingTransportValue;
	shuffle: boolean;
	setShuffle: Dispatch<SetStateAction<boolean>>;
	repeat: RepeatMode;
	setRepeat: Dispatch<SetStateAction<RepeatMode>>;
	hasPrev: boolean;
	hasNext: boolean;
	goPrev: () => void;
	goNext: () => void;
	loopStart: number | null;
	loopEnd: number | null;
	setLoopStart: Dispatch<SetStateAction<number | null>>;
	setLoopEnd: Dispatch<SetStateAction<number | null>>;
	seekStepSeconds: 5 | 10 | 30;
	setSeekStepSeconds: Dispatch<SetStateAction<5 | 10 | 30>>;
	onSeekRelative: (delta: number) => void;
}

export function MusicPlayerMasterDetail(
	props: MusicPlayerMasterDetailProps
): JSX.Element {
	const { t } = useTranslation('desktopUi');
	const {
		showStageDock,
		headerStripClass,
		queue,
		onReorderQueue,
		onMoveQueueItemToTop,
		onAddCurrentListToQueue,
		canAddCurrentList,
		trackListScrollRef,
		loadMoreSentinelRef,
		presentationGapsBanner,
		loading,
		error,
		onRetryLoad,
		filteredTracks,
		emptyStateKind,
		contentPanelClass,
		isFilteredEmptyList,
		hasSearchQuery,
		hasActiveTag,
		hasPlaylistSelection,
		hasOriginFilter,
		onClearSearch,
		onClearActiveTag,
		onClearPlaylistSelection,
		onClearOriginFilter,
		onShowAllMusic,
		onOpenMusicGenerator,
		onOpenContentManager,
		isSearchFilterPending,
		currentTrackId,
		errorTrackId,
		playing,
		isLoading,
		onPlayTrack,
		onRowContextMenu,
		favoriteIdsSet,
		onToggleFavorite,
		trackListDensity,
		trackListViewMode,
		hasMore,
		isLoadingMore,
		onLoadMore,
		stageDockTrack,
		stageDockIsFavorite,
		onToggleStageFavorite,
		nowPlaying,
		shuffle,
		setShuffle,
		repeat,
		setRepeat,
		hasPrev,
		hasNext,
		goPrev,
		goNext,
		loopStart,
		loopEnd,
		setLoopStart,
		setLoopEnd,
		seekStepSeconds,
		setSeekStepSeconds,
		onSeekRelative,
	} = props;

	return (
		<div className={MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS}>
			<div className={MUSIC_PLAYER_MASTER_DETAIL_ROW_CLASS}>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{showStageDock ? (
						<div
							className={MUSIC_PLAYER_STACKED_QUEUE_WRAP_CLASS}
							data-music-player-guide="queue-panel"
						>
							<MusicPlayerQueuePanel
								queue={queue}
								headerStripClass={headerStripClass}
								onReorderQueue={onReorderQueue}
								onMoveQueueItemToTop={onMoveQueueItemToTop}
								onAddCurrentListToQueue={onAddCurrentListToQueue}
								canAddCurrentList={canAddCurrentList}
							/>
						</div>
					) : null}

					<div
						ref={trackListScrollRef}
						className={MUSIC_PLAYER_TRACK_LIST_SCROLL_CLASS}
						data-music-player-guide="track-list"
					>
						{presentationGapsBanner ? (
							<div
								role="status"
								className={MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS}
							>
								{presentationGapsBanner}
							</div>
						) : null}
						{loading ? (
							<div
								className="space-y-3 py-2"
								aria-busy="true"
								aria-live="polite"
							>
								<MusicPlayerLoadingSkeleton
									viewMode={trackListViewMode}
									density={trackListDensity}
								/>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'text-center text-(--desktop-text-muted)'
									)}
								>
									{t('musicPlayer.loadingCatalog')}
								</p>
							</div>
						) : error ? (
							<div
								role="alert"
								className="mx-auto my-6 max-w-md rounded-(--desktop-radius-xl) border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100"
							>
								<p className="mb-1 font-medium">
									{t('musicPlayer.loadErrorTitle')}
								</p>
								<p className="text-red-200/85">{error}</p>
								<button
									type="button"
									onClick={onRetryLoad}
									className={cn(
										'mt-3 inline-flex min-h-8 items-center rounded-(--desktop-radius-lg) border border-red-400/35 bg-red-900/40 px-3 text-xs font-medium text-red-50 transition hover:bg-red-900/55',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
								>
									{t('musicPlayer.retryLoad')}
								</button>
							</div>
						) : filteredTracks.length === 0 ? (
							<MusicPlayerEmptyState
								kind={emptyStateKind}
								contentPanelClass={contentPanelClass}
								strokeWidth={sw}
								showFilterResetActions={isFilteredEmptyList}
								hasSearchQuery={hasSearchQuery}
								hasActiveTag={hasActiveTag}
								hasPlaylistSelection={hasPlaylistSelection}
								hasOriginFilter={hasOriginFilter}
								onClearSearch={onClearSearch}
								onClearActiveTag={onClearActiveTag}
								onClearPlaylistSelection={onClearPlaylistSelection}
								onClearOriginFilter={onClearOriginFilter}
								onShowAllMusic={onShowAllMusic}
								onOpenMusicGenerator={onOpenMusicGenerator}
								onOpenContentManager={onOpenContentManager}
							/>
						) : (
							<div
								className={cn(
									'min-h-0 transition-opacity duration-150',
									isSearchFilterPending && 'opacity-[0.72]'
								)}
							>
								<MusicPlayerTrackList
									items={filteredTracks}
									currentTrackId={currentTrackId}
									errorTrackId={errorTrackId}
									playing={playing}
									isLoading={isLoading}
									strokeWidth={sw}
									scrollParentRef={trackListScrollRef}
									onPlayTrack={onPlayTrack}
									onRowContextMenu={onRowContextMenu}
									favoriteIdsSet={favoriteIdsSet}
									onToggleFavorite={onToggleFavorite}
									density={trackListDensity}
									viewMode={trackListViewMode}
								/>
							</div>
						)}
						{hasMore && !loading ? (
							<div
								ref={loadMoreSentinelRef}
								className="pointer-events-none h-1 w-full shrink-0"
								aria-hidden
							/>
						) : null}
						{hasMore && !loading ? (
							<div className="mt-4 flex justify-center">
								<button
									type="button"
									onClick={onLoadMore}
									disabled={isLoadingMore}
									className={cn(
										'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) px-4 py-2 text-xs font-medium text-(--desktop-text-secondary) transition',
										'hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-(--desktop-surface-soft-hover) disabled:opacity-60'
									)}
								>
									{isLoadingMore
										? t('musicPlayer.loadingMore')
										: t('musicPlayer.loadMore')}
								</button>
							</div>
						) : null}
					</div>
				</div>
				{showStageDock ? (
					<MusicPlayerStageDock
						track={stageDockTrack}
						playing={playing}
						isFavorite={stageDockIsFavorite}
						onToggleFavorite={onToggleStageFavorite}
						strokeWidth={sw}
						queue={queue}
						onReorderQueue={onReorderQueue}
						onMoveQueueItemToTop={onMoveQueueItemToTop}
						onAddCurrentListToQueue={onAddCurrentListToQueue}
						canAddCurrentList={canAddCurrentList}
					/>
				) : null}
			</div>

			<div data-music-player-guide="now-playing">
				<MusicPlayerNowPlayingBar
					contentPanelClass={contentPanelClass}
					nowPlaying={nowPlaying}
					shuffle={shuffle}
					setShuffle={setShuffle}
					repeat={repeat}
					setRepeat={setRepeat}
					hasPrev={hasPrev}
					hasNext={hasNext}
					goPrev={goPrev}
					goNext={goNext}
					loopStart={loopStart}
					loopEnd={loopEnd}
					setLoopStart={setLoopStart}
					setLoopEnd={setLoopEnd}
					seekStepSeconds={seekStepSeconds}
					setSeekStepSeconds={setSeekStepSeconds}
					onSeekRelative={onSeekRelative}
					loading={loading}
					filteredTrackCount={filteredTracks.length}
					strokeWidth={sw}
				/>
			</div>
		</div>
	);
}
