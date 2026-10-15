/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin Desktop Music Player page orchestrator for catalog, track pipeline, playlists,
 * shortcuts, stage-dock preference, and playback controls (body layout in MusicPlayerMasterDetail).
 *
 * Invariants:
 * - Playback transport state is authoritative from NowPlaying/MusicPlayback contexts.
 * - Global shortcuts ignore focused text inputs/content-editable surfaces.
 * - Selected playlist (incl. «Любимые») hydrates missing track rows via content batch so the list
 *   is not limited to the first paginated catalog page.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerMasterDetail.tsx
 * - src/pages/MusicPlayer/useMusicPlayerCatalog.ts
 * - src/pages/MusicPlayer/useMusicPlayerTrackPipeline.ts
 * - src/pages/MusicPlayer/useMusicPlayerPlaylistActions.ts
 * - musicPlayerGuideConstants.ts, public/audio/music-player-guide/
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { cn } from '@/lib/utils';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	FolderOpenIcon,
	MagnifyingGlassIcon,
	QueueListIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../Desktop/components/DesktopAppChrome';
import { useNowPlayingTransport } from '../Desktop/context/NowPlayingContext';
import { useMusicPlaybackDomain } from '../Desktop/context/MusicPlaybackDomainContext';
import { useMusicLibraryContext } from '../Desktop/context/MusicLibraryContext';
import { useDesktopShellFrame } from '../Desktop/context/DesktopShellFrameContext';
import { useDesktopWindowSurfaceState } from '../Desktop/context/DesktopWindowActiveContext';
import type { WindowInitialPayload } from '../Desktop/types/desktop.types';
import {
	consumePendingMusicPlayFromStorage,
	requestOpenDesktopApp,
} from '../Desktop/utils/desktopDeepLink';
import {
	MUSIC_PLAYER_GUIDE_AUDIO_LS_KEY,
	MUSIC_PLAYER_GUIDE_ROOT_ID,
	MUSIC_PLAYER_GUIDE_STEP_DEFS,
	MUSIC_PLAYER_GUIDE_TOUR_FOLDER,
} from './musicPlayerGuideConstants';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../Desktop/utils/desktopVisualSystem';
import { MusicPlayerAbLoopEffect } from './MusicPlayerAbLoopEffect';
import {
	KeyboardShortcutsHelpModal,
	PlaylistNameDialog,
} from './MusicPlayerDialogs';
import { MusicPlayerMasterDetail } from './MusicPlayerMasterDetail';
import { MusicPlayerSecondaryToolbar } from './MusicPlayerSecondaryToolbar';
import { MusicPlayerTrackContextMenu } from './MusicPlayerTrackContextMenu';
import {
	persistMusicPlayerPreference,
	readStageDockOpen,
	readTrackListDensity,
	readTrackListViewMode,
	searchInputClass,
	segmentBtn,
	shellClassEmbedded,
	shellClassStandalone,
	STAGE_DOCK_OPEN_STORAGE_KEY,
	sw,
	TRACK_LIST_DENSITY_STORAGE_KEY,
	TRACK_LIST_VIEW_MODE_STORAGE_KEY,
	type TrackListDensity,
	type TrackListViewMode,
} from './musicPlayerPageConstants';
import { MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS } from './musicPlayerChrome';
import { useMusicPlayerCatalog } from './useMusicPlayerCatalog';
import { useMusicPlayerPageShortcuts } from './useMusicPlayerPageShortcuts';
import { useMusicPlayerPlaylistActions } from './useMusicPlayerPlaylistActions';
import { useMusicPlayerTrackActions } from './useMusicPlayerTrackActions';
import { useMusicPlayerTrackPipeline } from './useMusicPlayerTrackPipeline';

export interface MusicPlayerPageProps {
	embedded?: boolean;
	onWindowPayloadChange?: (patch: WindowInitialPayload) => void;
}

export const MusicPlayerPage: React.FC<MusicPlayerPageProps> = ({
	embedded = false,
	onWindowPayloadChange,
}) => {
	const { t: tDesktop, i18n } = useTranslation('desktopUi');
	const guideLabels = useMemo(
		() => guideTourLabelsFromI18n(tDesktop, 'musicPlayer.guide'),
		[tDesktop]
	);
	const guideSteps = useBuiltGuideSteps(
		tDesktop,
		'musicPlayer.guide.steps',
		MUSIC_PLAYER_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const musicPlayerLocale = i18n.language;
	const np = useNowPlayingTransport();
	const [trackListDensity, setTrackListDensity] =
		useState<TrackListDensity>(readTrackListDensity);
	const [trackListViewMode, setTrackListViewMode] = useState<TrackListViewMode>(
		readTrackListViewMode
	);
	const [tagsExpanded, setTagsExpanded] = useState(false);
	const [loopStart, setLoopStart] = useState<number | null>(null);
	const [loopEnd, setLoopEnd] = useState<number | null>(null);
	const [seekStepSeconds, setSeekStepSeconds] = useState<5 | 10 | 30>(5);
	const [showQueuePanel, setShowQueuePanel] = useState(readStageDockOpen);
	const toggleStageDock = useCallback(() => {
		setShowQueuePanel((open) => {
			const next = !open;
			persistMusicPlayerPreference(
				STAGE_DOCK_OPEN_STORAGE_KEY,
				next ? '1' : '0'
			);
			return next;
		});
	}, []);
	const {
		shuffle,
		setShuffle,
		repeat,
		setRepeat,
		queue,
		setPlayerPlaybackBrowseOverride,
		playTrack: playTrackFromDomain,
		hasPrev,
		hasNext,
		goPrev,
		goNext,
		enqueue,
		enqueueNext,
		reorderQueue,
		moveQueueItemToTop,
		removeFromQueue,
	} = useMusicPlaybackDomain();
	const {
		playlists,
		favoriteIdsSet,
		favoritesPlaylistTrackCount,
		persistPlaylists,
		toggleFavorite,
		removeTrackFromPlaylists,
		upsertTrack,
		ensureCatalogLoaded,
	} = useMusicLibraryContext();
	const {
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
	} = useMusicPlayerCatalog({
		ensureCatalogLoaded,
		loadListFallbackMessage: tDesktop(
			'musicPlayer.notifications.loadListFallback'
		),
	});
	const trackActions = useMusicPlayerTrackActions({
		transport: np,
		playTrackFromDomain,
		upsertTrack,
		favoriteIdsSet,
		toggleFavorite,
		removeFromQueue,
		removeTrackFromPlaylists,
		setTracks,
		setTotal,
		t: tDesktop,
	});
	const {
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
	} = useMusicPlayerTrackPipeline({
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
		t: tDesktop,
	});
	const playlistActions = useMusicPlayerPlaylistActions({
		playlists,
		persistPlaylists,
		currentPlaylistId,
		setCurrentPlaylistId,
		currentPlaylistEntry,
		filteredTracks,
		musicPlayerLocale,
		t: tDesktop,
	});

	const shellFrame = useDesktopShellFrame();
	const windowSurface = useDesktopWindowSurfaceState();
	const isForegroundWindow = windowSurface.backgroundLevel === 'foreground';
	const shortcuts = useMusicPlayerPageShortcuts({
		isForegroundWindow,
		transport: np,
		seekStepSeconds,
		setRepeat,
		setShuffle,
	});
	const headerStripClass = useMemo(
		() => getDesktopShellHeaderStripClassName(shellFrame),
		[shellFrame]
	);
	const searchShellClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'flex w-full items-center gap-2 rounded-(--desktop-radius) px-2.5 py-1.5 transition-colors duration-200 focus-within:border-[rgb(var(--desktop-accent-rgb)/0.55)] focus-within:ring-1 focus-within:ring-[rgb(var(--desktop-accent-rgb)/0.2)] md:w-auto'
			),
		[shellFrame]
	);
	const segmentShellClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterClassName(shellFrame),
				'flex rounded-(--desktop-radius) p-0.5'
			),
		[shellFrame]
	);
	const contentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const playlistSelectClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'rounded-md px-2 py-0.5 text-[11px] text-(--desktop-text-primary)',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);

	const openContentManager = useCallback(() => {
		requestOpenDesktopApp({
			appComponent: 'ContentManagerPro',
			contentManagerFolderItemId: 'music',
		});
	}, []);

	const openMusicStudio = useCallback(() => {
		requestOpenDesktopApp({ appComponent: 'MusicForgeApp' });
	}, []);

	const prepareGuideStep = useCallback(
		(stepId: string) => {
			if (stepId === 'queue-panel') {
				setShowQueuePanel(true);
			}
			if (stepId === 'shortcuts') {
				shortcuts.openKeyboardShortcuts();
			}
		},
		[shortcuts.openKeyboardShortcuts]
	);
	const toggleTrackListDensity = useCallback(() => {
		setTrackListDensity((current) =>
			current === 'compact' ? 'dense' : 'compact'
		);
	}, []);
	const toggleTrackListViewMode = useCallback(() => {
		setTrackListViewMode((current) => (current === 'list' ? 'grid' : 'list'));
	}, []);
	useEffect(() => {
		persistMusicPlayerPreference(
			TRACK_LIST_DENSITY_STORAGE_KEY,
			trackListDensity
		);
	}, [trackListDensity]);
	useEffect(() => {
		persistMusicPlayerPreference(
			TRACK_LIST_VIEW_MODE_STORAGE_KEY,
			trackListViewMode
		);
	}, [trackListViewMode]);

	const currentTrackId = np.track?.id ?? null;
	const stageDockTrack = useMemo(() => {
		if (!np.track) return null;
		const fromCatalog = tracks.find((row) => row.id === np.track?.id);
		const primaryTag =
			Array.isArray(fromCatalog?.tags) && fromCatalog.tags.length > 0
				? String(fromCatalog.tags[0])
				: null;
		return {
			id: np.track.id,
			name: np.track.name,
			thumbnail_url: np.track.thumbnail_url ?? fromCatalog?.thumbnail_url,
			mime_type: fromCatalog?.mime_type ?? null,
			primaryTag,
		};
	}, [np.track, tracks]);
	const stageDockIsFavorite = Boolean(
		currentTrackId && favoriteIdsSet.has(currentTrackId)
	);

	useEffect(() => {
		if (!embedded || !onWindowPayloadChange) return;
		const tid = (currentTrackId ?? '').trim();
		const tname = np.track?.name?.trim() ?? '';
		const appLabel = tDesktop('assistantCtxApps.musicPlayer');
		onWindowPayloadChange({
			assistantSurfaceContext: {
				label: tname ? `${appLabel} · ${tname}` : appLabel,
				...(tid ? { unifiedContentIds: [tid] } : {}),
			},
			...(tid ? { unifiedContentId: tid } : { unifiedContentId: undefined }),
		});
	}, [
		embedded,
		onWindowPayloadChange,
		currentTrackId,
		np.track?.name,
		tDesktop,
	]);

	useEffect(() => {
		const pending = consumePendingMusicPlayFromStorage();
		if (pending) {
			playTrackFromDomain({
				id: pending.id,
				name: pending.name,
				thumbnail_url: pending.thumbnail_url ?? null,
				version: null,
			});
		}
	}, [playTrackFromDomain]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: root click dismisses context menu
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users close menu via Escape or choosing an action
		<div
			className={embedded ? shellClassEmbedded : shellClassStandalone}
			id={MUSIC_PLAYER_GUIDE_ROOT_ID}
			data-music-player-root
			onClick={trackActions.dismissContextMenu}
		>
			{np.playing && np.track ? (
				<div
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgb(var(--desktop-accent-rgb)/0.11),transparent_52%),radial-gradient(circle_at_100%_100%,rgb(var(--desktop-accent-rgb)/0.06),transparent_48%)] transition-opacity duration-500"
					aria-hidden
				/>
			) : (
				<div
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgb(var(--desktop-accent-rgb)/0.06),transparent_42%)]"
					aria-hidden
				/>
			)}
			<div className="relative z-10 flex min-h-0 flex-1 flex-col">
				<MusicPlayerAbLoopEffect loopStart={loopStart} loopEnd={loopEnd} />
				<h1 className="sr-only">{tDesktop('assistantCtxApps.musicPlayer')}</h1>
				<MusicPlayerSecondaryToolbar
					headerStripClass={headerStripClass}
					leadingChrome={
						<>
							<div className={searchShellClass}>
								<MagnifyingGlassIcon
									className="h-4 w-4 shrink-0 text-(--desktop-text-dim)"
									strokeWidth={sw}
								/>
								<input
									ref={shortcuts.searchInputRef}
									type="search"
									value={searchQuery}
									onChange={onSearchInputChange}
									placeholder={tDesktop('musicPlayer.header.searchPlaceholder')}
									aria-label={tDesktop('musicPlayer.header.searchAria')}
									className={searchInputClass}
								/>
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-1.5">
								<span className={MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS}>
									{tDesktop('musicPlayer.header.librarySourceLabel')}
								</span>
								<div className={segmentShellClass}>
									<button
										type="button"
										onClick={selectFilterMusic}
										className={segmentBtn(filterMode === 'music')}
									>
										<FolderOpenIcon
											className="h-4 w-4 shrink-0"
											strokeWidth={sw}
										/>
										{tDesktop('musicPlayer.header.filterMusicSegment')}
									</button>
									<button
										type="button"
										onClick={selectFilterAll}
										className={segmentBtn(filterMode === 'all')}
									>
										<QueueListIcon
											className="h-4 w-4 shrink-0"
											strokeWidth={sw}
										/>
										{tDesktop('musicPlayer.header.filterAllSegment')}
									</button>
								</div>
							</div>
						</>
					}
					popularTags={popularTags}
					activeTag={activeTag}
					onClearActiveTag={onClearActiveTag}
					onTagClick={onTagClick}
					tagsExpanded={tagsExpanded}
					onToggleTagsExpanded={() => setTagsExpanded((open) => !open)}
					originFilter={originFilter}
					onOriginFilterChange={onOriginFilterChange}
					playlists={playlists}
					currentPlaylistId={currentPlaylistId}
					onPlaylistPickerChange={onPlaylistPickerChange}
					playlistSelectClass={playlistSelectClass}
					strokeWidth={sw}
					onCreatePlaylist={playlistActions.openCreatePlaylistDialog}
					onDuplicateCurrentPlaylist={playlistActions.duplicateCurrentPlaylist}
					onExportPlaylists={playlistActions.exportPlaylists}
					onImportPlaylists={playlistActions.triggerImportPlaylists}
					onRenameCurrentPlaylist={playlistActions.openRenamePlaylistDialog}
					onDeleteCurrentPlaylist={playlistActions.deleteCurrentPlaylist}
					currentPlaylistName={currentPlaylistDetails?.name ?? null}
					currentPlaylistTrackCount={currentPlaylistDetails?.trackCount ?? 0}
					currentPlaylistTotalDurationSeconds={
						currentPlaylistDetails?.totalDurationSeconds ?? null
					}
					queueLength={queue.length}
					queuePanelOpen={showQueuePanel}
					onToggleQueuePanel={toggleStageDock}
					sortField={sortField}
					sortOrder={sortOrder}
					trackListDensity={trackListDensity}
					onToggleTrackListDensity={toggleTrackListDensity}
					trackListViewMode={trackListViewMode}
					onToggleTrackListViewMode={toggleTrackListViewMode}
					onSortFieldName={onSortFieldName}
					onSortFieldDate={onSortFieldDate}
					onSortFieldUpdated={onSortFieldUpdated}
					onSortFieldDuration={onSortFieldDuration}
					onToggleSortOrder={onToggleSortOrder}
					showDurationSortWarning={showDurationSortWarning}
					durationSortMissingCount={durationSortGaps.missingDurationCount}
				/>
				<MusicPlayerMasterDetail
					showStageDock={showQueuePanel}
					headerStripClass={headerStripClass}
					queue={queue}
					onReorderQueue={reorderQueue}
					onMoveQueueItemToTop={moveQueueItemToTop}
					onAddCurrentListToQueue={addFilteredTracksToQueue}
					canAddCurrentList={filteredTracks.length > 0}
					trackListScrollRef={trackListScrollRef}
					loadMoreSentinelRef={loadMoreSentinelRef}
					presentationGapsBanner={presentationGapsBanner}
					loading={loading}
					error={error}
					onRetryLoad={() => void fetchTracks(true)}
					filteredTracks={filteredTracks}
					emptyStateKind={emptyStateKind}
					contentPanelClass={contentPanelClass}
					isFilteredEmptyList={isFilteredEmptyList}
					hasSearchQuery={Boolean(deferredFilterQuery)}
					hasActiveTag={Boolean(activeTag)}
					hasPlaylistSelection={Boolean(currentPlaylistId)}
					hasOriginFilter={originFilter !== 'all'}
					onClearSearch={clearSearchQuery}
					onClearActiveTag={onClearActiveTag}
					onClearPlaylistSelection={clearPlaylistSelection}
					onClearOriginFilter={clearOriginFilter}
					onShowAllMusic={selectFilterAll}
					onOpenMusicGenerator={openMusicStudio}
					onOpenContentManager={openContentManager}
					isSearchFilterPending={isSearchFilterPending}
					currentTrackId={currentTrackId}
					errorTrackId={np.errorTrackId}
					playing={np.playing}
					isLoading={np.isLoading}
					onPlayTrack={trackActions.handlePlayTrack}
					onRowContextMenu={trackActions.handleTrackRowContextMenu}
					favoriteIdsSet={favoriteIdsSet}
					onToggleFavorite={trackActions.handleToggleFavorite}
					trackListDensity={trackListDensity}
					trackListViewMode={trackListViewMode}
					hasMore={hasMore}
					isLoadingMore={isLoadingMore}
					onLoadMore={loadMoreTracks}
					stageDockTrack={stageDockTrack}
					stageDockIsFavorite={stageDockIsFavorite}
					onToggleStageFavorite={() => {
						if (currentTrackId) toggleFavorite(currentTrackId);
					}}
					nowPlaying={np}
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
					onSeekRelative={shortcuts.seekRelative}
				/>
				<input
					ref={playlistActions.playlistImportInputRef}
					type="file"
					accept="application/json,.json"
					className="hidden"
					onChange={(event) => {
						void playlistActions.handleImportPlaylists(event);
					}}
				/>
				<MusicPlayerTrackContextMenu
					menu={trackActions.contextMenu}
					isFavorite={
						trackActions.contextMenu
							? favoriteIdsSet.has(trackActions.contextMenu.track.id)
							: false
					}
					isQueued={
						trackActions.contextMenu
							? queueTrackIdsSet.has(trackActions.contextMenu.track.id)
							: false
					}
					onPlayTrack={trackActions.handlePlayTrack}
					onEnqueueNext={(track) => {
						enqueueNext({
							id: track.id,
							name: track.name,
							thumbnail_url: track.thumbnail_url ?? null,
							version: track.file_hash ?? track.updated_at,
						});
					}}
					onEnqueue={(track) => {
						enqueue({
							id: track.id,
							name: track.name,
							thumbnail_url: track.thumbnail_url ?? null,
							version: track.file_hash ?? track.updated_at,
						});
					}}
					onToggleFavorite={trackActions.toggleFavoriteWithFeedback}
					onRemoveFromQueue={removeFromQueue}
					onDeleteTrack={(track) => {
						trackActions.handleDeleteTrackFromLibrary(track);
					}}
					onClose={trackActions.dismissContextMenu}
				/>
				<PlaylistNameDialog
					open={playlistActions.showPlaylistNameDialog}
					titleId={playlistActions.playlistDialogTitleId}
					title={
						playlistActions.playlistNameDialogMode === 'create'
							? tDesktop('musicPlayer.playlistDialog.createTitle')
							: tDesktop('musicPlayer.playlistDialog.renameTitle')
					}
					description={
						playlistActions.playlistNameDialogMode === 'create'
							? tDesktop('musicPlayer.playlistDialog.createDescription')
							: tDesktop('musicPlayer.playlistDialog.renameDescription')
					}
					playlistNameDraft={playlistActions.playlistNameDraft}
					onDraftChange={playlistActions.setPlaylistNameDraft}
					onCancel={playlistActions.closePlaylistNameDialog}
					onConfirm={playlistActions.confirmPlaylistNameDialog}
					canConfirm={playlistActions.canConfirmPlaylistName}
					confirmLabel={
						playlistActions.playlistNameDialogMode === 'create'
							? tDesktop('musicPlayer.playlistDialog.createConfirm')
							: tDesktop('musicPlayer.playlistDialog.saveConfirm')
					}
					placeholder={
						playlistActions.playlistNameDialogMode === 'create'
							? tDesktop('musicPlayer.playlistDialog.createPlaceholder')
							: tDesktop('musicPlayer.playlistDialog.renamePlaceholder')
					}
					validationMessage={playlistActions.playlistNameValidationMessage}
				/>
				<KeyboardShortcutsHelpModal
					open={shortcuts.showKeyboardShortcuts}
					titleId={shortcuts.keyboardShortcutsTitleId}
					onClose={shortcuts.closeKeyboardShortcuts}
				/>
				<ConfirmDeleteModal
					isOpen={trackActions.deleteTrackConfirm !== null}
					onClose={trackActions.closeDeleteTrackConfirm}
					onConfirm={trackActions.confirmDeleteTrackFromLibrary}
					title={tDesktop('musicPlayer.deleteConfirm.title')}
					warningMessage={
						trackActions.deleteTrackConfirm
							? tDesktop('musicPlayer.deleteConfirm.message', {
									name: trackActions.deleteTrackConfirm.name,
								})
							: ''
					}
					confirmButtonLabel={tDesktop('musicPlayer.deleteConfirm.confirm')}
					confirmButtonLoadingLabel={tDesktop(
						'musicPlayer.deleteConfirm.confirmLoading'
					)}
					cancelButtonLabel={tDesktop('musicPlayer.deleteConfirm.cancel')}
				/>
				<span role="status" aria-live="polite" className="sr-only">
					{trackActions.favoriteFeedback ?? ''}
				</span>
				<SpotlightGuideModal
					open={guideOpen}
					onClose={() => setGuideOpen(false)}
					rootId={MUSIC_PLAYER_GUIDE_ROOT_ID}
					steps={guideSteps}
					audioLocalStorageKey={MUSIC_PLAYER_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={MUSIC_PLAYER_GUIDE_TOUR_FOLDER}
					labels={guideLabels}
					onPrepareStep={prepareGuideStep}
					spotlightLayoutKey={`${guideOpen}-${showQueuePanel}-${shortcuts.showKeyboardShortcuts}`}
					dialogTitleId="music-player-guide-title"
				/>
			</div>
		</div>
	);
};

export default MusicPlayerPage;
