/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders and memoizes one Music Player list row with playback, favorite, and metadata affordances.
 *
 * Invariants:
 * - Row click, keyboard activation, context menu, and favorite actions remain independently accessible.
 * - Memo comparison covers every visual Content field consumed by the row.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 * - src/pages/MusicPlayer/musicPlayerUtils.ts
 */

import { cn } from '@/lib/utils';
import {
	ArrowPathIcon,
	MusicalNoteIcon,
	PauseIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import * as React from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentThumbnail } from '../../components/UnifiedContent/components/ContentThumbnail';
import type { Content } from '../../components/UnifiedContent/types';
import { FavoriteHexIcon } from './MusicPlayerFavoriteHex';
import {
	buildTrackMetadataChips,
	formatTrackDurationLabel,
	readTrackSecondaryMetadata,
	shallowStringArrayEqual,
	trackDurationSeconds,
	trackRowMetadataEqual,
} from './musicPlayerUtils';

export interface MusicTrackRowProps {
	item: Content;
	index: number;
	isCurrent: boolean;
	isError: boolean;
	playing: boolean;
	isLoading: boolean;
	strokeWidth: number;
	onPlay: (item: Content) => void;
	onRowContextMenu: (event: React.MouseEvent, item: Content) => void;
	/** Track membership in the built-in favorites playlist. */
	isFavorite: boolean;
	onToggleFavorite: (event: React.MouseEvent, item: Content) => void;
	animateEntrance: boolean;
	listIndex: number;
	density: 'compact' | 'dense';
	as?: 'li' | 'div';
}

function musicTrackRowPropsEqual(
	previous: MusicTrackRowProps,
	next: MusicTrackRowProps
): boolean {
	if (previous.item !== next.item) {
		if (previous.item.id !== next.item.id) return false;
		if (previous.item.name !== next.item.name) return false;
		if (previous.item.mime_type !== next.item.mime_type) return false;
		if (!shallowStringArrayEqual(previous.item.tags, next.item.tags)) {
			return false;
		}
		if (!trackRowMetadataEqual(previous.item.metadata, next.item.metadata)) {
			return false;
		}
	}
	return (
		previous.index === next.index &&
		previous.listIndex === next.listIndex &&
		previous.isCurrent === next.isCurrent &&
		previous.isError === next.isError &&
		previous.playing === next.playing &&
		previous.isLoading === next.isLoading &&
		previous.animateEntrance === next.animateEntrance &&
		previous.strokeWidth === next.strokeWidth &&
		previous.as === next.as &&
		previous.onPlay === next.onPlay &&
		previous.onRowContextMenu === next.onRowContextMenu &&
		previous.isFavorite === next.isFavorite &&
		previous.onToggleFavorite === next.onToggleFavorite &&
		previous.density === next.density
	);
}

export const MusicTrackRow = memo(function MusicTrackRow({
	item,
	index,
	isCurrent,
	isError,
	playing,
	isLoading,
	strokeWidth: sw,
	onPlay,
	onRowContextMenu,
	isFavorite,
	onToggleFavorite,
	animateEntrance,
	listIndex,
	density,
	as: Tag = 'li',
}: MusicTrackRowProps) {
	const { t, i18n } = useTranslation('desktopUi');
	const handleRowClick = useCallback(() => {
		onPlay(item);
	}, [item, onPlay]);

	const handleRowKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onPlay(item);
			}
		},
		[item, onPlay]
	);

	const handleFavoriteClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			onToggleFavorite(event, item);
		},
		[item, onToggleFavorite]
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			onRowContextMenu(event, item);
		},
		[item, onRowContextMenu]
	);

	const entranceTransition = useMemo(
		() => ({ delay: Math.min(index * 0.02, 0.3) }),
		[index]
	);
	const durationSeconds = trackDurationSeconds(item.metadata);
	const durationLabel = formatTrackDurationLabel(durationSeconds);
	const primaryTag =
		Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : null;
	const secondaryMetadata = readTrackSecondaryMetadata(item, i18n.language);
	const narrowMetadataChips = useMemo(
		() =>
			buildTrackMetadataChips(secondaryMetadata, {
				formatStyle: (style) =>
					t('musicPlayer.trackRow.metadata.style', { style }),
				formatBpm: (bpm) => t('musicPlayer.trackRow.metadata.bpm', { bpm }),
				formatSource: (source) =>
					t('musicPlayer.trackRow.metadata.source', { source }),
				formatCreated: (date) =>
					t('musicPlayer.trackRow.metadata.created', { date }),
			}),
		[secondaryMetadata, t]
	);
	const wideInlineChips = useMemo(
		() =>
			buildTrackMetadataChips(
				{
					style: secondaryMetadata.style,
					bpm: secondaryMetadata.bpm,
					sourceApp: null,
					createdDateLabel: null,
				},
				{
					formatStyle: (style) =>
						t('musicPlayer.trackRow.metadata.style', { style }),
					formatBpm: (bpm) => t('musicPlayer.trackRow.metadata.bpm', { bpm }),
					formatSource: (source) =>
						t('musicPlayer.trackRow.metadata.source', { source }),
					formatCreated: (date) =>
						t('musicPlayer.trackRow.metadata.created', { date }),
				}
			),
		[secondaryMetadata.bpm, secondaryMetadata.style, t]
	);
	const playTrackAria = t('musicPlayer.trackRow.playTrackAria', {
		name: item.name,
	});
	const rowClass = cn(
		'flex cursor-pointer items-center rounded-(--desktop-radius-lg) transition-colors duration-200',
		density === 'dense' ? 'gap-2 p-2' : 'gap-3 p-2.5',
		isCurrent
			? 'border border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-(--desktop-surface-accent-strong) text-(--desktop-text-primary) shadow-(--desktop-shadow-soft)'
			: isError
				? 'border border-red-500/45 bg-red-950/30 text-red-100'
				: 'border border-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
	);

	const inner = (
		<>
			<span className="w-6 shrink-0 text-right text-xs tabular-nums text-(--desktop-text-dim)">
				{isCurrent ? (
					playing ? (
						<span
							className="inline-flex items-center justify-end text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							title={t('musicPlayer.trackRow.playing')}
						>
							<PlayIcon className="h-3 w-3" strokeWidth={sw} aria-hidden />
						</span>
					) : (
						<span
							className="inline-flex items-center justify-end text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							title={t('musicPlayer.trackRow.paused')}
						>
							<PauseIcon className="h-3 w-3" strokeWidth={sw} aria-hidden />
						</span>
					)
				) : (
					listIndex + 1
				)}
			</span>
			<div
				className={cn(
					'shrink-0 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
					density === 'dense' ? 'h-9 w-9' : 'h-10 w-10'
				)}
			>
				<ContentThumbnail
					contentId={item.id}
					className="h-full w-full object-cover"
					skipThumbnail
				>
					<div className="flex h-full w-full items-center justify-center">
						<MusicalNoteIcon
							className="h-5 w-5 text-(--desktop-text-dim)"
							strokeWidth={sw}
						/>
					</div>
				</ContentThumbnail>
			</div>
			<button
				type="button"
				onClick={handleFavoriteClick}
				className={cn(
					'shrink-0 rounded-md p-0.5 transition-[color,transform,opacity] active:scale-95',
					'outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-(--desktop-surface-app)',
					isFavorite
						? 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
						: 'text-(--desktop-text-dim) opacity-70 hover:opacity-100'
				)}
				aria-label={
					isFavorite
						? t('musicPlayer.trackRow.removeFavorite')
						: t('musicPlayer.trackRow.addFavorite')
				}
				title={
					isFavorite
						? t('musicPlayer.trackRow.inFavorites')
						: t('musicPlayer.trackRow.addToFavorites')
				}
			>
				<FavoriteHexIcon filled={isFavorite} className="h-5 w-5" />
			</button>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center justify-between gap-2">
						<p
							className={cn(
								'truncate font-medium text-(--desktop-text-primary)',
								density === 'dense' ? 'text-[13px]' : 'text-sm'
							)}
						>
							{item.name}
						</p>
						{isCurrent && playing && (
							<div
								className="hidden h-3 items-end gap-0.5 text-[rgb(var(--desktop-accent-rgb)/0.85)] sm:flex"
								aria-hidden="true"
							>
								<span className="h-2 w-0.5 animate-pulse rounded-sm bg-current" />
								<span className="h-3 w-0.5 animate-pulse rounded-sm bg-current [animation-delay:80ms]" />
								<span className="h-2.5 w-0.5 animate-pulse rounded-sm bg-current [animation-delay:160ms]" />
							</div>
						)}
					</div>
					<div
						className={cn(
							'mt-0.5 flex items-center gap-2 text-(--desktop-text-muted)',
							density === 'dense' ? 'text-[10px]' : 'text-[11px]'
						)}
					>
						{item.mime_type && (
							<span className="max-w-[40%] truncate">{item.mime_type}</span>
						)}
						{primaryTag && (
							<span className="max-w-[30%] truncate rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] text-(--desktop-text-secondary)">
								#{primaryTag}
							</span>
						)}
					</div>
					{narrowMetadataChips.length > 0 ? (
						<div className="mt-1 flex flex-wrap items-center gap-1 @min-[1100px]:hidden">
							{narrowMetadataChips.map((chip) => (
								<span
									key={chip}
									className="max-w-[45%] truncate rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] text-(--desktop-text-muted)"
									title={chip}
								>
									{chip}
								</span>
							))}
						</div>
					) : null}
					{wideInlineChips.length > 0 ? (
						<div className="mt-1 hidden flex-wrap items-center gap-1 @min-[1100px]:flex">
							{wideInlineChips.map((chip) => (
								<span
									key={chip}
									className="max-w-[45%] truncate rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] text-(--desktop-text-muted)"
									title={chip}
								>
									{chip}
								</span>
							))}
						</div>
					) : null}
				</div>
				<div
					className={cn(
						'hidden shrink-0 truncate text-(--desktop-text-muted) @min-[1100px]:block',
						density === 'dense' ? 'w-24 text-[10px]' : 'w-28 text-[11px]'
					)}
					title={secondaryMetadata.createdDateLabel ?? undefined}
				>
					{secondaryMetadata.createdDateLabel ?? '—'}
				</div>
				<div
					className={cn(
						'hidden shrink-0 truncate text-(--desktop-text-muted) @min-[1100px]:block',
						density === 'dense' ? 'w-28 text-[10px]' : 'w-32 text-[11px]'
					)}
					title={
						secondaryMetadata.sourceApp
							? secondaryMetadata.sourceApp.replaceAll('_', ' ').trim()
							: undefined
					}
				>
					{secondaryMetadata.sourceApp
						? secondaryMetadata.sourceApp.replaceAll('_', ' ').trim()
						: '—'}
				</div>
				<div
					className={cn(
						'text-right font-variant-numeric tabular-nums text-(--desktop-text-muted)',
						density === 'dense' ? 'w-16 text-[10px]' : 'w-20 text-[11px]'
					)}
				>
					{durationLabel}
				</div>
			</div>
			{isCurrent ? (
				isLoading ? (
					<ArrowPathIcon
						className="h-5 w-5 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						strokeWidth={sw}
					/>
				) : playing ? (
					<PauseIcon
						className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						strokeWidth={sw}
					/>
				) : (
					<PlayIcon
						className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
						strokeWidth={sw}
					/>
				)
			) : (
				<div className="flex shrink-0 items-center gap-1">
					{isError && (
						<span className="rounded-full border border-red-500/55 bg-red-950/60 px-1.5 py-0.5 text-[10px] text-red-100">
							{t('musicPlayer.trackRow.playbackErrorBadge')}
						</span>
					)}
					<PlayIcon
						className="h-5 w-5 text-(--desktop-text-dim)"
						strokeWidth={sw}
					/>
				</div>
			)}
		</>
	);

	if (Tag === 'li') {
		if (animateEntrance) {
			return (
				<motion.li
					layout={false}
					className="block list-none p-0"
					data-music-current={isCurrent ? true : undefined}
				>
					<motion.div
						layout={false}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={entranceTransition}
						role="button"
						tabIndex={0}
						className={rowClass}
						aria-label={playTrackAria}
						onClick={handleRowClick}
						onKeyDown={handleRowKeyDown}
						onContextMenu={handleContextMenu}
					>
						{inner}
					</motion.div>
				</motion.li>
			);
		}
		return (
			<li
				className="list-none p-0"
				data-music-current={isCurrent ? true : undefined}
			>
				{/* biome-ignore lint/a11y/useSemanticElements: row contains a nested favorite button, so a native button would be invalid */}
				<div
					role="button"
					tabIndex={0}
					className={rowClass}
					aria-label={playTrackAria}
					onClick={handleRowClick}
					onKeyDown={handleRowKeyDown}
					onContextMenu={handleContextMenu}
				>
					{inner}
				</div>
			</li>
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: virtual row contains a nested favorite button, so a native button would be invalid
		<div
			className={rowClass}
			data-music-current={isCurrent ? true : undefined}
			role="button"
			tabIndex={0}
			aria-label={playTrackAria}
			onClick={handleRowClick}
			onKeyDown={handleRowKeyDown}
			onContextMenu={handleContextMenu}
		>
			{inner}
		</div>
	);
}, musicTrackRowPropsEqual);
