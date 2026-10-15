/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wide-layout stage dock: now-playing context + embedded queue beside the catalog.
 *
 * Invariants:
 * - Queue interactions match stacked MusicPlayerQueuePanel (reorder / move-to-top).
 * - Dock is presentation-only; transport stays NowPlaying / MusicPlaybackDomain.
 *
 * Related:
 * - MusicPlayerPage.tsx, MusicPlayerQueuePanel.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentThumbnail } from '../../components/UnifiedContent/components/ContentThumbnail';
import {
	MUSIC_PLAYER_INSET_X,
	MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS,
	MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS,
	MUSIC_PLAYER_STAGE_DOCK_CLASS,
} from './musicPlayerChrome';
import { FavoriteHexIcon } from './MusicPlayerFavoriteHex';
import { MusicPlayerQueuePanel } from './MusicPlayerQueuePanel';

export type MusicPlayerStageDockTrack = {
	id: string;
	name: string;
	thumbnail_url?: string | null;
	mime_type?: string | null;
	primaryTag?: string | null;
};

export interface MusicPlayerStageDockProps {
	track: MusicPlayerStageDockTrack | null;
	playing: boolean;
	isFavorite: boolean;
	onToggleFavorite: () => void;
	strokeWidth: number;
	queue: Array<{
		id: string;
		name: string;
		thumbnail_url?: string | null;
	}>;
	onReorderQueue: (fromIndex: number, toIndex: number) => void;
	onMoveQueueItemToTop: (trackId: string) => void;
	onAddCurrentListToQueue: () => void;
	canAddCurrentList: boolean;
}

export function MusicPlayerStageDock({
	track,
	playing,
	isFavorite,
	onToggleFavorite,
	strokeWidth: sw,
	queue,
	onReorderQueue,
	onMoveQueueItemToTop,
	onAddCurrentListToQueue,
	canAddCurrentList,
}: MusicPlayerStageDockProps): JSX.Element {
	const { t } = useTranslation('desktopUi');

	return (
		<aside
			className={MUSIC_PLAYER_STAGE_DOCK_CLASS}
			data-music-player-guide="stage-dock"
			aria-label={t('musicPlayer.stageDock.regionAria')}
		>
			<div
				className={cn(
					'shrink-0 border-b border-(--desktop-border-subtle)/70 py-3',
					MUSIC_PLAYER_INSET_X
				)}
			>
				<p className={MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS}>
					{playing
						? t('musicPlayer.stageDock.nowPlaying')
						: t('musicPlayer.stageDock.selected')}
				</p>
				{track ? (
					<div className="mt-2 flex items-start gap-3">
						<div className="h-16 w-16 shrink-0 overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
							<ContentThumbnail
								contentId={track.id}
								className="h-full w-full object-cover"
								skipThumbnail={!track.thumbnail_url}
							>
								<div className="flex h-full w-full items-center justify-center">
									<MusicalNoteIcon
										className="h-7 w-7 text-(--desktop-text-dim)"
										strokeWidth={sw}
										aria-hidden
									/>
								</div>
							</ContentThumbnail>
						</div>
						<div className="min-w-0 flex-1">
							<p
								className={MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS}
								title={track.name}
							>
								{track.name}
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-(--desktop-text-muted)">
								{track.mime_type ? (
									<span className="truncate">{track.mime_type}</span>
								) : null}
								{track.primaryTag ? (
									<span className="truncate rounded-full border border-(--desktop-border-subtle) px-1.5 py-0.5">
										#{track.primaryTag}
									</span>
								) : null}
							</div>
							<button
								type="button"
								onClick={onToggleFavorite}
								className={cn(
									'mt-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] transition',
									'outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]',
									isFavorite
										? 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
										: 'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)'
								)}
								aria-label={
									isFavorite
										? t('musicPlayer.trackRow.removeFavorite')
										: t('musicPlayer.trackRow.addFavorite')
								}
							>
								<FavoriteHexIcon filled={isFavorite} className="h-4 w-4" />
								<span>
									{isFavorite
										? t('musicPlayer.stageDock.inFavorites')
										: t('musicPlayer.stageDock.addFavorite')}
								</span>
							</button>
						</div>
					</div>
				) : (
					<p className="mt-2 text-[11px] text-(--desktop-text-muted)">
						{t('musicPlayer.stageDock.emptyHint')}
					</p>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<MusicPlayerQueuePanel
					queue={queue}
					headerStripClass=""
					variant="embedded"
					onReorderQueue={onReorderQueue}
					onMoveQueueItemToTop={onMoveQueueItemToTop}
					onAddCurrentListToQueue={onAddCurrentListToQueue}
					canAddCurrentList={canAddCurrentList}
				/>
			</div>
		</aside>
	);
}
