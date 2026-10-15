/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible queue panel for upcoming Music Player tracks.
 *
 * Invariants:
 * - First queue item is the immediate "queued next" track.
 * - Empty queue keeps actionable guidance for context-menu enqueue flow.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/Desktop/context/MusicPlaybackDomainContext.tsx
 */

import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MUSIC_PLAYER_INSET_X } from './musicPlayerChrome';

type QueuePanelTrack = {
	id: string;
	name: string;
	thumbnail_url?: string | null;
};

export interface MusicPlayerQueuePanelProps {
	queue: QueuePanelTrack[];
	headerStripClass: string;
	/** stacked = strip above list; embedded = inside wide stage dock */
	variant?: 'stacked' | 'embedded';
	onReorderQueue: (fromIndex: number, toIndex: number) => void;
	onMoveQueueItemToTop: (trackId: string) => void;
	onAddCurrentListToQueue: () => void;
	canAddCurrentList: boolean;
}

export function MusicPlayerQueuePanel({
	queue,
	headerStripClass,
	variant = 'stacked',
	onReorderQueue,
	onMoveQueueItemToTop,
	onAddCurrentListToQueue,
	canAddCurrentList,
}: MusicPlayerQueuePanelProps): React.JSX.Element {
	const { t } = useTranslation('desktopUi');
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const embedded = variant === 'embedded';

	return (
		<div
			className={cn(
				embedded ? 'min-h-0 flex-1 pb-2' : 'shrink-0 pb-2',
				MUSIC_PLAYER_INSET_X,
				headerStripClass
			)}
		>
			<div
				className={cn(
					'p-3',
					embedded
						? 'border-0 bg-transparent p-0 pt-3'
						: 'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)'
				)}
			>
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="text-xs font-semibold tracking-wide text-(--desktop-text-primary)">
						{t('musicPlayer.queue.title')}
					</h3>
					<span className="rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-[10px] text-(--desktop-text-muted) tabular-nums">
						{queue.length}
					</span>
				</div>
				{queue.length === 0 ? (
					<div className="space-y-2">
						<p className="text-[11px] text-(--desktop-text-muted)">
							{t('musicPlayer.queue.emptyHint')}
						</p>
						<button
							type="button"
							disabled={!canAddCurrentList}
							onClick={onAddCurrentListToQueue}
							className="rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-55"
						>
							{t('musicPlayer.queue.addCurrentList')}
						</button>
					</div>
				) : (
					<ul className="space-y-1.5">
						{queue.map((track, index) => (
							<li
								key={track.id}
								draggable
								onDragStart={() => {
									setDragFromIndex(index);
									setDragOverIndex(index);
								}}
								onDragOver={(event) => {
									event.preventDefault();
									if (dragOverIndex !== index) {
										setDragOverIndex(index);
									}
								}}
								onDrop={(event) => {
									event.preventDefault();
									if (dragFromIndex != null) {
										onReorderQueue(dragFromIndex, index);
									}
									setDragFromIndex(null);
									setDragOverIndex(null);
								}}
								onDragEnd={() => {
									setDragFromIndex(null);
									setDragOverIndex(null);
								}}
								className={cn(
									'flex items-center gap-2 rounded-(--desktop-radius) border px-2 py-1.5 text-[11px]',
									dragOverIndex === index &&
										dragFromIndex !== index &&
										'border-[rgb(var(--desktop-accent-rgb)/0.5)]',
									index === 0
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)]'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
								)}
							>
								{track.thumbnail_url ? (
									<img
										src={track.thumbnail_url}
										alt=""
										className="h-7 w-7 shrink-0 rounded border border-(--desktop-border-subtle) object-cover"
									/>
								) : (
									<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)">
										<MusicalNoteIcon
											className="h-4 w-4 text-(--desktop-text-dim)"
											aria-hidden
										/>
									</div>
								)}
								<div className="min-w-0 flex-1">
									<p
										className="truncate text-(--desktop-text-primary)"
										title={track.name}
									>
										{track.name}
									</p>
								</div>
								{index === 0 ? (
									<span className="shrink-0 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.45)] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)]">
										{t('musicPlayer.queue.nextBadge')}
									</span>
								) : (
									<div className="flex shrink-0 items-center gap-1">
										<span className="text-[10px] tabular-nums text-(--desktop-text-dim)">
											#{index + 1}
										</span>
										<button
											type="button"
											onClick={() => onMoveQueueItemToTop(track.id)}
											className="rounded-full border border-(--desktop-border-subtle) px-1.5 py-px text-[10px] text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-panel) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset"
										>
											{t('musicPlayer.queue.moveUp')}
										</button>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
