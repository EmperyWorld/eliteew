/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track row context menu for Music Player playback, queue, favorites and catalog actions.
 *
 * Invariants:
 * - Menu positions within viewport margins after mount.
 * - Actions delegate to MusicPlayerPage handlers; menu closes after each action.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import { cn } from '@/lib/utils';
import { memo, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Content } from '../../components/UnifiedContent/types';

export type MusicPlayerTrackContextMenuState = {
	x: number;
	y: number;
	track: Content;
} | null;

type MusicPlayerTrackContextMenuProps = {
	menu: MusicPlayerTrackContextMenuState;
	isFavorite: boolean;
	isQueued: boolean;
	onPlayTrack: (track: Content) => void;
	onEnqueueNext: (track: Content) => void;
	onEnqueue: (track: Content) => void;
	onToggleFavorite: (trackId: string) => void;
	onRemoveFromQueue: (trackId: string) => void;
	onDeleteTrack: (track: Content) => void;
	onClose: () => void;
};

const menuItemClass =
	'w-full px-3 py-1.5 text-left text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)';

export const MusicPlayerTrackContextMenu = memo(
	function MusicPlayerTrackContextMenu({
		menu,
		isFavorite,
		isQueued,
		onPlayTrack,
		onEnqueueNext,
		onEnqueue,
		onToggleFavorite,
		onRemoveFromQueue,
		onDeleteTrack,
		onClose,
	}: MusicPlayerTrackContextMenuProps) {
		const { t } = useTranslation('desktopUi');
		const contextMenuRef = useRef<HTMLDivElement>(null);

		useLayoutEffect(() => {
			if (!menu || !contextMenuRef.current) return;
			const el = contextMenuRef.current;
			const margin = 8;
			const rect = el.getBoundingClientRect();
			let left = menu.x;
			let top = menu.y;
			if (left + rect.width > window.innerWidth - margin) {
				left = Math.max(margin, window.innerWidth - rect.width - margin);
			}
			if (top + rect.height > window.innerHeight - margin) {
				top = Math.max(margin, window.innerHeight - rect.height - margin);
			}
			left = Math.max(margin, left);
			top = Math.max(margin, top);
			el.style.left = `${left}px`;
			el.style.top = `${top}px`;
		}, [menu]);

		if (!menu) return null;
		const { track } = menu;

		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: menu is operated via inner buttons
			<div
				ref={contextMenuRef}
				role="menu"
				aria-label={track.name}
				className={cn(
					'fixed z-50 min-w-[180px] rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) py-1 text-xs',
					'bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary) shadow-(--desktop-shadow) backdrop-blur-xl'
				)}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					role="menuitem"
					className={menuItemClass}
					onClick={() => {
						onPlayTrack(track);
						onClose();
					}}
				>
					{t('musicPlayer.contextMenu.play')}
				</button>
				<button
					type="button"
					role="menuitem"
					className={menuItemClass}
					onClick={() => {
						onEnqueueNext(track);
						onClose();
					}}
				>
					{t('musicPlayer.contextMenu.playNext')}
				</button>
				<button
					type="button"
					role="menuitem"
					className={menuItemClass}
					onClick={() => {
						onEnqueue(track);
						onClose();
					}}
				>
					{t('musicPlayer.contextMenu.enqueue')}
				</button>
				<button
					type="button"
					role="menuitem"
					className={menuItemClass}
					onClick={() => {
						onToggleFavorite(track.id);
						onClose();
					}}
				>
					{isFavorite
						? t('musicPlayer.contextMenu.removeFavorite')
						: t('musicPlayer.contextMenu.addFavorite')}
				</button>
				{isQueued ? (
					<button
						type="button"
						role="menuitem"
						className={menuItemClass}
						onClick={() => {
							onRemoveFromQueue(track.id);
							onClose();
						}}
					>
						{t('musicPlayer.contextMenu.removeFromQueue')}
					</button>
				) : null}
				<button
					type="button"
					role="menuitem"
					className={menuItemClass}
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(track.name);
						} catch {
							// Clipboard unavailable — safe to ignore for copy action.
						}
						onClose();
					}}
				>
					{t('musicPlayer.contextMenu.copyName')}
				</button>
				<div
					className="my-1 border-t border-(--desktop-border-subtle)"
					aria-hidden
				/>
				<button
					type="button"
					role="menuitem"
					className="w-full px-3 py-1.5 text-left text-red-400 transition hover:bg-red-950/40 hover:text-red-300"
					onClick={() => {
						onDeleteTrack(track);
						onClose();
					}}
				>
					{t('musicPlayer.contextMenu.deleteFromCatalog')}
				</button>
			</div>
		);
	}
);
