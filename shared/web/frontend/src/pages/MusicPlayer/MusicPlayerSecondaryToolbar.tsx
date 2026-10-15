/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Music Player chrome strip: search/library segments, tags, playlists, queue and sort.
 *
 * Invariants:
 * - Queue status and panel toggle reflect `MusicPlaybackDomainContext.queue`.
 * - Tag/origin filters stay visible in the secondary toolbar.
 * - Toolbar meta stays sentence-case (musicPlayerChrome tokens).
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/musicPlayerChrome.ts
 */

import { cn } from '@/lib/utils';
import { ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { formatDuration } from '../../utils/formatDuration';
import { MusicPlayerPlaylistPicker } from './MusicPlayerPlaylistPicker';
import {
	MUSIC_PLAYER_CHROME_TOOLBAR_CLASS,
	MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS,
	MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS,
	MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS,
	musicPlayerToolbarChipClass,
	musicPlayerToolbarPillClass,
} from './musicPlayerChrome';
import {
	FAVORITES_PLAYLIST_ID,
	type SavedPlaylist,
	type TrackOriginFilter,
	type TrackSortField,
	type TrackSortOrder,
} from './musicPlayerTypes';
import {
	MUSIC_PLAYER_VISIBLE_TAG_LIMIT,
	sliceVisibleTags,
} from './musicPlayerUtils';

type MusicPlayerSecondaryToolbarProps = {
	headerStripClass: string;
	/** Search + library segment controls — merged into this single chrome strip. */
	leadingChrome?: ReactNode;
	popularTags: string[];
	activeTag: string | null;
	onClearActiveTag: () => void;
	onTagClick: (tag: string) => void;
	tagsExpanded: boolean;
	onToggleTagsExpanded: () => void;
	originFilter: TrackOriginFilter;
	onOriginFilterChange: (next: TrackOriginFilter) => void;
	playlists: SavedPlaylist[];
	currentPlaylistId: string | null;
	onPlaylistPickerChange: (id: string | null) => void;
	playlistSelectClass: string;
	strokeWidth: number;
	onCreatePlaylist: () => void;
	onDuplicateCurrentPlaylist: () => void;
	onExportPlaylists: () => void;
	onImportPlaylists: () => void;
	onRenameCurrentPlaylist: () => void;
	onDeleteCurrentPlaylist: () => void;
	currentPlaylistName: string | null;
	currentPlaylistTrackCount: number;
	currentPlaylistTotalDurationSeconds: number | null;
	queueLength: number;
	queuePanelOpen: boolean;
	onToggleQueuePanel: () => void;
	sortField: TrackSortField;
	sortOrder: TrackSortOrder;
	trackListDensity: 'compact' | 'dense';
	onToggleTrackListDensity: () => void;
	trackListViewMode: 'list' | 'grid';
	onToggleTrackListViewMode: () => void;
	onSortFieldName: () => void;
	onSortFieldDate: () => void;
	onSortFieldUpdated: () => void;
	onSortFieldDuration: () => void;
	onToggleSortOrder: () => void;
	showDurationSortWarning: boolean;
	durationSortMissingCount: number;
};

export const MusicPlayerSecondaryToolbar = memo(
	function MusicPlayerSecondaryToolbar({
		headerStripClass,
		leadingChrome,
		popularTags,
		activeTag,
		onClearActiveTag,
		onTagClick,
		tagsExpanded,
		onToggleTagsExpanded,
		originFilter,
		onOriginFilterChange,
		playlists,
		currentPlaylistId,
		onPlaylistPickerChange,
		playlistSelectClass,
		strokeWidth,
		onCreatePlaylist,
		onDuplicateCurrentPlaylist,
		onExportPlaylists,
		onImportPlaylists,
		onRenameCurrentPlaylist,
		onDeleteCurrentPlaylist,
		currentPlaylistName,
		currentPlaylistTrackCount,
		currentPlaylistTotalDurationSeconds,
		queueLength,
		queuePanelOpen,
		onToggleQueuePanel,
		sortField,
		sortOrder,
		trackListDensity,
		onToggleTrackListDensity,
		trackListViewMode,
		onToggleTrackListViewMode,
		onSortFieldName,
		onSortFieldDate,
		onSortFieldUpdated,
		onSortFieldDuration,
		onToggleSortOrder,
		showDurationSortWarning,
		durationSortMissingCount,
	}: MusicPlayerSecondaryToolbarProps) {
		const { t } = useTranslation('desktopUi');

		const { visibleTags, hiddenCount } = sliceVisibleTags(popularTags, {
			limit: MUSIC_PLAYER_VISIBLE_TAG_LIMIT,
			expanded: tagsExpanded,
			activeTag,
		});

		return (
			<div
				className={cn(MUSIC_PLAYER_CHROME_TOOLBAR_CLASS, headerStripClass)}
				data-music-player-guide="chrome-toolbar"
			>
				{leadingChrome ? (
					<div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
						{leadingChrome}
					</div>
				) : null}
				<div className="flex max-w-full flex-wrap items-center justify-between gap-2">
					<div className="flex max-w-full min-w-0 flex-1 flex-col gap-1.5">
						{popularTags.length > 0 ? (
							<div className="flex max-w-full flex-wrap items-center gap-1">
								{activeTag ? (
									<button
										type="button"
										onClick={onClearActiveTag}
										className={cn(
											musicPlayerToolbarPillClass(true),
											'inline-flex max-w-40 items-center gap-1'
										)}
										title={t('musicPlayer.toolbar.clearFilterTag', {
											tag: activeTag,
										})}
									>
										<span className="truncate">
											{t('musicPlayer.toolbar.filterTag', {
												tag: activeTag,
											})}
										</span>
										<span aria-hidden className="text-(--desktop-text-dim)">
											×
										</span>
									</button>
								) : null}
								<button
									type="button"
									onClick={onClearActiveTag}
									className={musicPlayerToolbarPillClass(activeTag === null)}
								>
									{t('musicPlayer.toolbar.allTags')}
								</button>
								{visibleTags
									.filter((tag) => tag !== activeTag)
									.map((tag) => (
										<button
											key={tag}
											type="button"
											onClick={() => onTagClick(tag)}
											className={musicPlayerToolbarPillClass(activeTag === tag)}
											title={t('musicPlayer.toolbar.filterByTag', { tag })}
										>
											#{tag}
										</button>
									))}
								{hiddenCount > 0 ? (
									<button
										type="button"
										onClick={onToggleTagsExpanded}
										className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
									>
										{tagsExpanded
											? t('musicPlayer.toolbar.tagsCollapse')
											: t('musicPlayer.toolbar.tagsExpand', {
													count: hiddenCount,
												})}
									</button>
								) : null}
							</div>
						) : null}
						<div className="flex flex-wrap items-center gap-1">
							<span
								className={cn(
									MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS,
									'mr-1 hidden sm:inline'
								)}
							>
								{t('musicPlayer.toolbar.sourceLabel')}
							</span>
							<button
								type="button"
								onClick={() => onOriginFilterChange('all')}
								className={musicPlayerToolbarChipClass(originFilter === 'all')}
							>
								{t('musicPlayer.toolbar.originAll')}
							</button>
							<button
								type="button"
								onClick={() => onOriginFilterChange('generated')}
								className={musicPlayerToolbarChipClass(
									originFilter === 'generated'
								)}
							>
								{t('musicPlayer.toolbar.originGenerated')}
							</button>
							<button
								type="button"
								onClick={() => onOriginFilterChange('uploaded')}
								className={musicPlayerToolbarChipClass(
									originFilter === 'uploaded'
								)}
							>
								{t('musicPlayer.toolbar.originUploaded')}
							</button>
						</div>
					</div>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'flex items-center gap-2'
						)}
					>
						<div className="flex flex-wrap items-center gap-1">
							<span
								className={cn(
									MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS,
									'hidden sm:inline'
								)}
							>
								{t('musicPlayer.toolbar.playlistLabel')}
							</span>
							<MusicPlayerPlaylistPicker
								playlists={playlists}
								currentPlaylistId={currentPlaylistId}
								onChange={onPlaylistPickerChange}
								triggerClassName={playlistSelectClass}
								strokeWidth={strokeWidth}
							/>
							{!currentPlaylistName ? (
								<button
									type="button"
									aria-label={t('musicPlayer.toolbar.createPlaylistAria')}
									onClick={onCreatePlaylist}
									className={cn(
										MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS,
										'border-[rgb(var(--desktop-accent-rgb)/0.4)] text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:bg-(--desktop-surface-accent)'
									)}
								>
									{t('musicPlayer.toolbar.savePlaylist')}
								</button>
							) : null}
						</div>
					</div>
				</div>
				{currentPlaylistName ? (
					<div className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft) px-2.5 py-1.5">
						<div className="min-w-0">
							<p className="truncate text-[11px] font-semibold text-(--desktop-text-primary)">
								{t('musicPlayer.toolbar.playlistDetail', {
									name: currentPlaylistName,
								})}
							</p>
							<p className={MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS}>
								{t('musicPlayer.toolbar.playlistMeta', {
									count: currentPlaylistTrackCount,
									duration:
										currentPlaylistTotalDurationSeconds != null
											? formatDuration(currentPlaylistTotalDurationSeconds)
											: '—:—',
								})}
							</p>
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								aria-label={t('musicPlayer.toolbar.duplicatePlaylistAria')}
								onClick={onDuplicateCurrentPlaylist}
								className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
							>
								{t('musicPlayer.toolbar.duplicatePlaylist')}
							</button>
							<button
								type="button"
								aria-label={t('musicPlayer.toolbar.exportPlaylistsAria')}
								onClick={onExportPlaylists}
								className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
							>
								{t('musicPlayer.toolbar.exportPlaylists')}
							</button>
							<button
								type="button"
								aria-label={t('musicPlayer.toolbar.importPlaylistsAria')}
								onClick={onImportPlaylists}
								className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
							>
								{t('musicPlayer.toolbar.importPlaylists')}
							</button>
							{currentPlaylistId !== FAVORITES_PLAYLIST_ID ? (
								<button
									type="button"
									aria-label={t('musicPlayer.toolbar.renamePlaylistAria')}
									onClick={onRenameCurrentPlaylist}
									className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
								>
									{t('musicPlayer.toolbar.renamePlaylist')}
								</button>
							) : null}
							<button
								type="button"
								aria-label={t('musicPlayer.toolbar.createPlaylistAria')}
								onClick={onCreatePlaylist}
								className={cn(
									MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS,
									'border-[rgb(var(--desktop-accent-rgb)/0.4)] text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:bg-(--desktop-surface-accent)'
								)}
							>
								{t('musicPlayer.toolbar.savePlaylist')}
							</button>
							<button
								type="button"
								onClick={onDeleteCurrentPlaylist}
								aria-label={
									currentPlaylistId === FAVORITES_PLAYLIST_ID
										? t('musicPlayer.toolbar.clearFavoritesAria')
										: t('musicPlayer.toolbar.deletePlaylistAria')
								}
								className={cn(
									MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS,
									'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)'
								)}
							>
								{currentPlaylistId === FAVORITES_PLAYLIST_ID
									? t('musicPlayer.toolbar.clearFavorites')
									: t('musicPlayer.toolbar.deletePlaylist')}
							</button>
						</div>
					</div>
				) : null}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.small,
							'min-w-0 flex-1 text-(--desktop-text-muted)'
						)}
					>
						<div className="flex flex-wrap items-center gap-2">
							{queueLength > 0 ? (
								<span>
									{t('musicPlayer.toolbar.queueCount', { count: queueLength })}
								</span>
							) : (
								<span>{t('musicPlayer.toolbar.queueEmptyHint')}</span>
							)}
							<button
								type="button"
								onClick={onToggleQueuePanel}
								className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
								data-music-player-guide="stage-dock-toggle"
							>
								{queuePanelOpen
									? t('musicPlayer.toolbar.hideStageDock')
									: t('musicPlayer.toolbar.showStageDock')}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-1 text-(--desktop-text-muted)">
						<span
							className={cn(
								MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS,
								'hidden sm:inline'
							)}
						>
							{t('musicPlayer.toolbar.sortLabel')}
						</span>
						<button
							type="button"
							onClick={onSortFieldName}
							className={musicPlayerToolbarChipClass(sortField === 'name')}
						>
							{t('musicPlayer.toolbar.sortName')}
						</button>
						<button
							type="button"
							onClick={onSortFieldDate}
							className={musicPlayerToolbarChipClass(sortField === 'date')}
						>
							{t('musicPlayer.toolbar.sortDate')}
						</button>
						<button
							type="button"
							onClick={onSortFieldUpdated}
							className={musicPlayerToolbarChipClass(sortField === 'updated')}
							title={t('musicPlayer.toolbar.sortUpdatedTitle')}
						>
							{t('musicPlayer.toolbar.sortUpdated')}
						</button>
						<button
							type="button"
							onClick={onSortFieldDuration}
							className={musicPlayerToolbarChipClass(sortField === 'duration')}
						>
							{t('musicPlayer.toolbar.sortDuration')}
						</button>
						<button
							type="button"
							onClick={onToggleSortOrder}
							className={cn(MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS, 'ml-1')}
							title={
								sortOrder === 'asc'
									? t('musicPlayer.toolbar.sortAscTitle')
									: t('musicPlayer.toolbar.sortDescTitle')
							}
						>
							<ArrowsUpDownIcon
								className="h-3 w-3 shrink-0"
								strokeWidth={strokeWidth}
							/>
							<span>
								{sortOrder === 'asc'
									? t('musicPlayer.toolbar.sortAscShort')
									: t('musicPlayer.toolbar.sortDescShort')}
							</span>
						</button>
						<button
							type="button"
							onClick={onToggleTrackListDensity}
							className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
							title={
								trackListDensity === 'dense'
									? t('musicPlayer.toolbar.densityDenseTitle')
									: t('musicPlayer.toolbar.densityComfortTitle')
							}
						>
							{trackListDensity === 'dense'
								? t('musicPlayer.toolbar.densityDense')
								: t('musicPlayer.toolbar.densityComfort')}
						</button>
						<button
							type="button"
							onClick={onToggleTrackListViewMode}
							className={MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS}
							title={
								trackListViewMode === 'grid'
									? t('musicPlayer.toolbar.viewGridTitle')
									: t('musicPlayer.toolbar.viewListTitle')
							}
						>
							{trackListViewMode === 'grid'
								? t('musicPlayer.toolbar.viewGrid')
								: t('musicPlayer.toolbar.viewList')}
						</button>
					</div>
				</div>
				{showDurationSortWarning ? (
					<p role="status" className={MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS}>
						{t('musicPlayer.toolbar.durationSortWarning', {
							count: durationSortMissingCount,
							countLabel:
								durationSortMissingCount === 1
									? t('musicPlayer.toolbar.durationSortMissingOne')
									: t('musicPlayer.toolbar.durationSortMissingMany'),
						})}
					</p>
				) : null}
			</div>
		);
	}
);
