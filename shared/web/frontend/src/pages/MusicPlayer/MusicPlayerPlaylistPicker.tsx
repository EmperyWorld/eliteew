/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dropdown picker for Music Player playlist scope (all tracks vs saved playlists).
 *
 * Invariants:
 * - Closes on Escape and outside click; restores focus to trigger on close.
 * - Favorites playlist shows hex icon; labels come from `desktopUi.musicPlayer.playlistPicker`.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerSecondaryToolbar.tsx
 */

import { cn } from '@/lib/utils';
import { ChevronDownIcon, QueueListIcon } from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../Desktop/components/DesktopAppChrome';
import { FavoriteHexIcon } from './MusicPlayerFavoriteHex';
import { resolveMusicPlayerPlaylistDisplayName } from './musicPlayerPlaylistDisplay';
import { FAVORITES_PLAYLIST_ID, type SavedPlaylist } from './musicPlayerTypes';

export interface MusicPlayerPlaylistPickerProps {
	playlists: SavedPlaylist[];
	currentPlaylistId: string | null;
	onChange: (id: string | null) => void;
	triggerClassName: string;
	strokeWidth: number;
}

export function MusicPlayerPlaylistPicker({
	playlists,
	currentPlaylistId,
	onChange,
	triggerClassName,
	strokeWidth: sw,
}: MusicPlayerPlaylistPickerProps) {
	const { t } = useTranslation('desktopUi');
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listId = useId();

	useLayoutEffect(() => {
		const el = triggerRef.current;
		if (!el) return;
		el.setAttribute('aria-expanded', open ? 'true' : 'false');
	}, [open]);

	const allTracksLabel = t('musicPlayer.playlistPicker.allTracks');
	const fallbackName = t('musicPlayer.playlistPicker.fallbackName');
	const favoritesName = t('musicPlayer.favoritesPlaylist.name');
	const ariaLabel = t('musicPlayer.playlistPicker.ariaLabel');

	const label = useMemo(() => {
		if (!currentPlaylistId) return allTracksLabel;
		const p = playlists.find((x) => x.id === currentPlaylistId);
		if (!p) return fallbackName;
		return resolveMusicPlayerPlaylistDisplayName(p, favoritesName);
	}, [
		allTracksLabel,
		currentPlaylistId,
		fallbackName,
		favoritesName,
		playlists,
	]);

	const close = useCallback(() => setOpen(false), []);

	const prevOpenRef = useRef(false);
	useEffect(() => {
		if (prevOpenRef.current && !open) {
			queueMicrotask(() => triggerRef.current?.focus());
		}
		prevOpenRef.current = open;
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (wrapRef.current?.contains(e.target as Node)) return;
			close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, close]);

	const select = useCallback(
		(id: string | null) => {
			onChange(id);
			close();
		},
		[onChange, close]
	);

	const itemBtn = cn(
		'flex min-h-8 w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors',
		'hover:bg-(--desktop-surface-soft-hover) focus:outline-none focus-visible:bg-(--desktop-surface-soft-hover)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);

	return (
		<div className="relative min-w-0 max-w-[min(100%,320px)]" ref={wrapRef}>
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="true"
				aria-controls={open ? listId : undefined}
				onClick={() => setOpen((o) => !o)}
				className={cn(
					triggerClassName,
					'flex w-full min-w-0 items-center justify-between gap-1.5 text-left'
				)}
			>
				<span className="min-w-0 flex-1 truncate">{label}</span>
				<ChevronDownIcon
					className={cn(
						'h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim) transition-transform',
						open && 'rotate-180'
					)}
					strokeWidth={sw}
					aria-hidden
				/>
			</button>
			{open ? (
				<fieldset
					id={listId}
					aria-label={ariaLabel}
					className={cn(
						'm-0 min-w-0 p-0',
						'absolute left-0 right-0 top-full z-60 mt-1 max-h-60 overflow-y-auto overflow-x-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
						'bg-(--desktop-surface-panel-strong) py-1 shadow-(--desktop-shadow) backdrop-blur-xl'
					)}
				>
					<button
						type="button"
						className={cn(
							itemBtn,
							currentPlaylistId === null && 'bg-(--desktop-surface-soft-active)'
						)}
						onClick={() => select(null)}
					>
						<QueueListIcon
							className="h-3.5 w-3.5 shrink-0 opacity-70"
							strokeWidth={sw}
						/>
						<span className="min-w-0 flex-1">{allTracksLabel}</span>
					</button>
					<div
						className="my-1 border-0 border-t border-(--desktop-border-subtle)"
						role="presentation"
						aria-hidden
					/>
					{playlists.map((p) => {
						const isFav = p.id === FAVORITES_PLAYLIST_ID;
						const selected = currentPlaylistId === p.id;
						return (
							<button
								key={p.id}
								type="button"
								className={cn(
									itemBtn,
									selected && 'bg-(--desktop-surface-soft-active)'
								)}
								onClick={() => select(p.id)}
							>
								{isFav ? (
									<FavoriteHexIcon
										className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
										filled
									/>
								) : (
									<span className="w-3.5 shrink-0" aria-hidden />
								)}
								<span className="min-w-0 flex-1 truncate">
									{resolveMusicPlayerPlaylistDisplayName(p, favoritesName)}
								</span>
								<span className="shrink-0 tabular-nums text-(--desktop-text-dim)">
									{p.trackIds.length}
								</span>
							</button>
						);
					})}
				</fieldset>
			) : null}
		</div>
	);
}
