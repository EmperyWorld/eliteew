/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selects plain, virtualized, or grid Music Player track-list presentation.
 *
 * Invariants:
 * - Plain and virtualized lists reuse the same memoized MusicTrackRow contract.
 * - Grid and list modes preserve keyboard, context-menu, and favorite interactions.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicTrackRow.tsx
 * - src/pages/MusicPlayer/musicPlayerUtils.ts
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentThumbnail } from '../../components/UnifiedContent/components/ContentThumbnail';
import type { Content } from '../../components/UnifiedContent/types';
import { MUSIC_LIST_VIRTUAL_THRESHOLD } from './musicPlayerTypes';
import {
	estimateMusicTrackRowHeightPx,
	getMusicTrackItemKey,
} from './musicPlayerListVirtual';
import {
	formatTrackDurationLabel,
	buildTrackMetadataChips,
	isGeneratedMusicTrack,
	readTrackSecondaryMetadata,
	trackDurationSeconds,
} from './musicPlayerUtils';
import { MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS } from './musicPlayerChrome';
import { FavoriteHexIcon } from './MusicPlayerFavoriteHex';
import { MusicTrackRow } from './MusicTrackRow';
import {
	ArrowPathIcon,
	MusicalNoteIcon,
	PauseIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';

export { MusicTrackRow };
export type { MusicTrackRowProps } from './MusicTrackRow';

const TrackListHeader = memo(function TrackListHeader() {
	const { t } = useTranslation('desktopUi');

	return (
		<div className={MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS}>
			<span className="w-6 text-right">#</span>
			<span className="w-10" />
			<span className="w-6" aria-hidden />
			<span className="min-w-0 flex-1">
				{t('musicPlayer.trackList.columnTrack')}
			</span>
			<span className="hidden w-28 shrink-0 @min-[1100px]:block">
				{t('musicPlayer.trackList.columnCreated')}
			</span>
			<span className="hidden w-32 shrink-0 @min-[1100px]:block">
				{t('musicPlayer.trackList.columnSource')}
			</span>
			<span className="w-20 pr-2 text-right sm:w-24">
				{t('musicPlayer.trackList.columnDuration')}
			</span>
			<span className="w-5" aria-hidden />
		</div>
	);
});

export interface MusicPlayerTrackListProps {
	items: Content[];
	currentTrackId: string | null;
	errorTrackId: string | null;
	playing: boolean;
	isLoading: boolean;
	strokeWidth: number;
	scrollParentRef: React.RefObject<HTMLDivElement | null>;
	onPlayTrack: (item: Content) => void;
	onRowContextMenu: (e: React.MouseEvent, item: Content) => void;
	favoriteIdsSet: Set<string>;
	onToggleFavorite: (e: React.MouseEvent, item: Content) => void;
	density: 'compact' | 'dense';
	viewMode: 'list' | 'grid';
}

function musicPlayerTrackListPropsEqual(
	prev: MusicPlayerTrackListProps,
	next: MusicPlayerTrackListProps
): boolean {
	if (prev.currentTrackId !== next.currentTrackId) return false;
	if (prev.errorTrackId !== next.errorTrackId) return false;
	if (prev.playing !== next.playing) return false;
	if (prev.isLoading !== next.isLoading) return false;
	if (prev.strokeWidth !== next.strokeWidth) return false;
	if (prev.scrollParentRef !== next.scrollParentRef) return false;
	if (prev.onPlayTrack !== next.onPlayTrack) return false;
	if (prev.onRowContextMenu !== next.onRowContextMenu) return false;
	if (prev.favoriteIdsSet !== next.favoriteIdsSet) return false;
	if (prev.onToggleFavorite !== next.onToggleFavorite) return false;
	if (prev.density !== next.density) return false;
	if (prev.viewMode !== next.viewMode) return false;
	if (prev.items === next.items) return true;

	const a = prev.items;
	const b = next.items;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

const MusicPlayerTrackListPlain = memo(function MusicPlayerTrackListPlain({
	items,
	currentTrackId,
	errorTrackId,
	playing,
	isLoading,
	strokeWidth,
	scrollParentRef,
	onPlayTrack,
	onRowContextMenu,
	favoriteIdsSet,
	onToggleFavorite,
	density,
}: MusicPlayerTrackListProps) {
	const { t } = useTranslation('desktopUi');
	const animateEntrance = items.length <= 50;

	useLayoutEffect(() => {
		if (!currentTrackId) return;
		const root = scrollParentRef.current;
		if (!root) return;
		const el = root.querySelector<HTMLElement>('[data-music-current]');
		el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [currentTrackId, scrollParentRef]);

	return (
		<>
			<TrackListHeader />
			<ul
				className="space-y-0.5"
				aria-label={t('musicPlayer.trackList.regionAria')}
			>
				{items.map((item, index) => {
					const isCurrent = item.id === currentTrackId;
					const isError = errorTrackId === item.id;
					return (
						<MusicTrackRow
							key={item.id}
							item={item}
							index={index}
							listIndex={index}
							isCurrent={isCurrent}
							isError={isError}
							playing={playing}
							isLoading={isLoading}
							strokeWidth={strokeWidth}
							onPlay={onPlayTrack}
							onRowContextMenu={onRowContextMenu}
							isFavorite={favoriteIdsSet.has(item.id)}
							onToggleFavorite={onToggleFavorite}
							animateEntrance={animateEntrance}
							density={density}
							as="li"
						/>
					);
				})}
			</ul>
		</>
	);
});

const MusicPlayerTrackListVirtual = memo(function MusicPlayerTrackListVirtual({
	items,
	currentTrackId,
	errorTrackId,
	playing,
	isLoading,
	strokeWidth,
	scrollParentRef,
	onPlayTrack,
	onRowContextMenu,
	favoriteIdsSet,
	onToggleFavorite,
	density,
}: MusicPlayerTrackListProps) {
	const { t } = useTranslation('desktopUi');
	const getItemKey = useCallback(
		(index: number) => getMusicTrackItemKey(items, index),
		[items]
	);

	const estimateSize = useCallback(
		(index: number) => estimateMusicTrackRowHeightPx(items[index], density),
		[density, items]
	);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollParentRef.current,
		estimateSize,
		overscan: items.length > 500 ? 6 : 12,
		getItemKey,
		useFlushSync: false,
	});

	const virtualizerRef = useRef(virtualizer);
	virtualizerRef.current = virtualizer;

	const trackIndexById = useMemo(() => {
		const m = new Map<string, number>();
		for (let i = 0; i < items.length; i++) {
			m.set(items[i].id, i);
		}
		return m;
	}, [items]);

	useLayoutEffect(() => {
		virtualizerRef.current.measure();
	}, []);

	useLayoutEffect(() => {
		if (!currentTrackId || items.length === 0) return;
		const idx = trackIndexById.get(currentTrackId);
		if (idx === undefined) return;
		const v = virtualizerRef.current;
		const visible = v.getVirtualItems();
		if (visible.some((vi) => vi.index === idx)) return;
		requestAnimationFrame(() => {
			const v2 = virtualizerRef.current;
			const vis = v2.getVirtualItems();
			if (vis.some((vi) => vi.index === idx)) return;
			v2.scrollToIndex(idx, { align: 'auto' });
		});
	}, [currentTrackId, items.length, trackIndexById]);

	return (
		<>
			<TrackListHeader />
			<ul
				className="relative m-0 min-h-0 w-full list-none p-0"
				aria-label={t('musicPlayer.trackList.regionAria')}
				style={{
					height: `${virtualizer.getTotalSize()}px`,
				}}
			>
				{virtualizer.getVirtualItems().map((v) => {
					const item = items[v.index];
					if (!item) return null;
					const isCurrent = item.id === currentTrackId;
					const isError = errorTrackId === item.id;
					return (
						<li
							key={v.key}
							data-index={v.index}
							ref={virtualizer.measureElement}
							className="absolute top-0 left-0 w-full min-w-0 list-none"
							style={{
								transform: `translateY(${v.start}px)`,
							}}
						>
							<div className="pb-0.5">
								<MusicTrackRow
									item={item}
									index={v.index}
									listIndex={v.index}
									isCurrent={isCurrent}
									isError={isError}
									playing={playing}
									isLoading={isLoading}
									strokeWidth={strokeWidth}
									onPlay={onPlayTrack}
									onRowContextMenu={onRowContextMenu}
									isFavorite={favoriteIdsSet.has(item.id)}
									onToggleFavorite={onToggleFavorite}
									animateEntrance={false}
									density={density}
									as="div"
								/>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
});

const MusicPlayerTrackListGrid = memo(function MusicPlayerTrackListGrid({
	items,
	currentTrackId,
	errorTrackId,
	playing,
	isLoading,
	strokeWidth: sw,
	scrollParentRef,
	onPlayTrack,
	onRowContextMenu,
	favoriteIdsSet,
	onToggleFavorite,
}: MusicPlayerTrackListProps) {
	const { t, i18n } = useTranslation('desktopUi');
	const metadataChipLabels = useMemo(
		() => ({
			formatStyle: (style: string) =>
				t('musicPlayer.trackRow.metadata.style', { style }),
			formatBpm: (bpm: number) =>
				t('musicPlayer.trackRow.metadata.bpm', { bpm }),
			formatSource: (source: string) =>
				t('musicPlayer.trackRow.metadata.source', { source }),
			formatCreated: (date: string) =>
				t('musicPlayer.trackRow.metadata.created', { date }),
		}),
		[t]
	);
	const orderedItems = useMemo(() => {
		const generated: Content[] = [];
		const others: Content[] = [];
		for (const item of items) {
			if (isGeneratedMusicTrack(item)) {
				generated.push(item);
			} else {
				others.push(item);
			}
		}
		return [...generated, ...others];
	}, [items]);

	useLayoutEffect(() => {
		if (!currentTrackId) return;
		const root = scrollParentRef.current;
		if (!root) return;
		const el = root.querySelector<HTMLElement>('[data-music-current]');
		el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [currentTrackId, scrollParentRef]);

	return (
		<div
			className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
			role="region"
			aria-label={t('musicPlayer.trackList.gridAria')}
		>
			{orderedItems.map((item) => {
				const isCurrent = item.id === currentTrackId;
				const isError = errorTrackId === item.id;
				const isGenerated = isGeneratedMusicTrack(item);
				const secondary = readTrackSecondaryMetadata(item, i18n.language);
				const durationLabel = formatTrackDurationLabel(
					trackDurationSeconds(item.metadata)
				);
				const chips = buildTrackMetadataChips(secondary, metadataChipLabels);
				const playTrackAria = t('musicPlayer.trackRow.playTrackAria', {
					name: item.name,
				});
				return (
					<div
						key={item.id}
						data-music-current={isCurrent ? true : undefined}
						role="button"
						tabIndex={0}
						aria-label={playTrackAria}
						onClick={() => onPlayTrack(item)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								onPlayTrack(item);
							}
						}}
						onContextMenu={(event) => onRowContextMenu(event, item)}
						className={cn(
							'group overflow-hidden rounded-(--desktop-radius-xl) border bg-(--desktop-surface-soft) transition',
							'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
							isCurrent
								? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-accent-strong)'
								: isError
									? 'border-red-500/45 bg-red-950/20'
									: 'border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover)'
						)}
					>
						<div className="relative aspect-square overflow-hidden bg-(--desktop-surface-panel)">
							<ContentThumbnail
								contentId={item.id}
								className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
								skipThumbnail
							>
								<div className="flex h-full w-full items-center justify-center">
									<MusicalNoteIcon
										className="h-8 w-8 text-(--desktop-text-dim)"
										strokeWidth={sw}
									/>
								</div>
							</ContentThumbnail>
							<div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/55 to-transparent" />
							<div className="absolute left-2 top-2 flex items-center gap-1">
								{isError ? (
									<span className="rounded-full border border-red-500/55 bg-red-950/75 px-1.5 py-0.5 text-[10px] font-medium text-red-100">
										{t('musicPlayer.trackRow.playbackErrorBadge')}
									</span>
								) : null}
								{isGenerated ? (
									<span className="rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.22)] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--desktop-fg-primary-rgb))]">
										{t('musicPlayer.trackList.generatedBadge')}
									</span>
								) : null}
								{durationLabel ? (
									<span className="rounded-full border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
										{durationLabel}
									</span>
								) : null}
							</div>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									onToggleFavorite(event, item);
								}}
								className={cn(
									'absolute right-2 top-2 rounded-md bg-black/35 p-1 transition hover:bg-black/55',
									'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
									favoriteIdsSet.has(item.id)
										? 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
										: 'text-white/75'
								)}
								aria-label={
									favoriteIdsSet.has(item.id)
										? t('musicPlayer.trackRow.removeFavorite')
										: t('musicPlayer.trackRow.addFavorite')
								}
							>
								<FavoriteHexIcon
									filled={favoriteIdsSet.has(item.id)}
									className="h-5 w-5"
								/>
							</button>
							{isCurrent ? (
								<div className="absolute bottom-2 right-2 rounded-full bg-black/45 p-1.5 text-white">
									{isLoading ? (
										<ArrowPathIcon
											className="h-4 w-4 animate-spin"
											strokeWidth={sw}
										/>
									) : playing ? (
										<PauseIcon className="h-4 w-4" strokeWidth={sw} />
									) : (
										<PlayIcon className="h-4 w-4" strokeWidth={sw} />
									)}
								</div>
							) : null}
						</div>
						<div className="space-y-1.5 p-2.5">
							<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
								{item.name}
							</p>
							{chips.length > 0 ? (
								<div className="flex flex-wrap gap-1">
									{chips.map((chip) => (
										<span
											key={`${item.id}-${chip}`}
											className="max-w-full truncate rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-1.5 py-0.5 text-[10px] text-(--desktop-text-muted)"
											title={chip}
										>
											{chip}
										</span>
									))}
								</div>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	);
});

export const MusicPlayerTrackList = memo(function MusicPlayerTrackList(
	props: MusicPlayerTrackListProps
) {
	if (props.viewMode === 'grid') {
		return <MusicPlayerTrackListGrid {...props} />;
	}
	if (props.items.length >= MUSIC_LIST_VIRTUAL_THRESHOLD) {
		return <MusicPlayerTrackListVirtual {...props} />;
	}
	return <MusicPlayerTrackListPlain {...props} />;
}, musicPlayerTrackListPropsEqual);
