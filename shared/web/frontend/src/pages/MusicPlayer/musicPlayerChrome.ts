/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared layout and control chrome tokens for Music Player surfaces.
 *
 * Invariants:
 * - Uses desktop shell CSS variables only; no hardcoded theme colors beyond accent rgb.
 * - Track-list / toolbar / now-playing meta stay sentence-case (no uppercase shout).
 *
 * Related:
 * - MusicPlayerPage.tsx, MusicPlayerSecondaryToolbar.tsx, MusicPlayerNowPlayingBar.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { cn } from '@/lib/utils';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/** Horizontal inset aligned with desktop shell header strip. */
export const MUSIC_PLAYER_INSET_X = 'px-3';

export const musicPlayerFooterStripClass = cn(
	MUSIC_PLAYER_INSET_X,
	'shrink-0 border-t border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_90%,rgb(var(--desktop-bg-primary-rgb))_10%)]',
	'backdrop-blur-md shadow-[0_-4px_18px_rgb(0_0_0/0.1)]'
);

export function musicPlayerUtilityChipClass(active = false): string {
	return cn(
		'inline-flex min-h-7 min-w-7 items-center justify-center rounded-full border px-2 tabular-nums transition',
		DESKTOP_TYPOGRAPHY.shellMeta10,
		'font-medium tracking-normal',
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset',
		active
			? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)] text-(--desktop-text-primary)'
			: 'border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
	);
}

/** Now-playing eyebrow («Сейчас играет») — sentence-case meta. */
export const MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'tracking-normal text-(--desktop-text-dim)'
);

export const MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'truncate font-semibold tracking-tight leading-tight text-(--desktop-text-primary)'
);

export const MUSIC_PLAYER_NOW_PLAYING_PAD_CLASS = 'py-2';

export const MUSIC_PLAYER_NOW_PLAYING_PLAY_BTN_CLASS = cn(
	'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-white transition',
	'bg-[rgb(var(--desktop-accent-rgb))] hover:brightness-110 active:brightness-95',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-inset',
	'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100',
	'disabled:focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.25)]'
);

export const MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS = cn(
	'inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 text-(--desktop-text-muted) transition-colors duration-200',
	'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset',
	'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-(--desktop-text-muted)',
	'disabled:focus-visible:ring-0'
);

/** Sticky # / Track / Duration column labels — sentence-case meta. */
export const MUSIC_PLAYER_TRACK_LIST_HEADER_CLASS = cn(
	'sticky top-0 z-1 hidden items-center gap-3 border-b border-(--desktop-border-subtle)/50',
	'bg-(--desktop-surface-app)/95 px-1 pb-2 pt-0.5 backdrop-blur-sm sm:flex',
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal text-(--desktop-text-dim)'
);

export const MUSIC_PLAYER_TRACK_LIST_SCROLL_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto pb-2 pt-1',
	MUSIC_PLAYER_INSET_X
);

/** Root container for ultrawide master–detail (@container queries). */
export const MUSIC_PLAYER_LAYOUT_CONTAINER_CLASS =
	'@container min-h-0 flex-1 flex flex-col';

/** Wide (≥1100px container): list + stage dock side by side. */
export const MUSIC_PLAYER_MASTER_DETAIL_ROW_CLASS = cn(
	'flex min-h-0 flex-1 flex-col',
	'@min-[1100px]:flex-row @min-[1100px]:gap-0'
);

export const MUSIC_PLAYER_STAGE_DOCK_CLASS = cn(
	'hidden min-h-0 w-full shrink-0 flex-col border-(--desktop-border-subtle)/80',
	'@min-[1100px]:flex @min-[1100px]:w-[min(22rem,34%)] @min-[1100px]:border-l',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(var(--desktop-bg-primary-rgb))_8%)]'
);

/** Stacked queue strip — hide when stage dock owns queue on wide. */
export const MUSIC_PLAYER_STACKED_QUEUE_WRAP_CLASS = '@min-[1100px]:hidden';

/** Partial metadata warning above the list — quiet desktop tokens (not amber shout). */
export const MUSIC_PLAYER_PRESENTATION_GAPS_BANNER_CLASS = cn(
	'mb-2.5 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,transparent)] px-3 py-2',
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'leading-snug tracking-normal text-(--desktop-text-secondary)'
);

/** Chrome toolbar shell (`data-music-player-guide="chrome-toolbar"`). */
export const MUSIC_PLAYER_CHROME_TOOLBAR_CLASS = cn(
	'relative shrink-0 flex flex-col gap-1.5 border-b border-(--desktop-border-subtle)/70',
	MUSIC_PLAYER_INSET_X,
	'py-2'
);

/** «Источник» / «Плейлист» / «Сортировка» captions — sentence-case meta. */
export const MUSIC_PLAYER_TOOLBAR_META_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'shrink-0 tracking-normal text-(--desktop-text-dim)'
);

const MUSIC_PLAYER_TOOLBAR_CHIP_BASE = cn(
	'rounded-full border px-2 py-0.5 transition-colors',
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-inset'
);

/** Tag pills in the chrome toolbar. */
export function musicPlayerToolbarPillClass(active: boolean): string {
	return cn(
		MUSIC_PLAYER_TOOLBAR_CHIP_BASE,
		'max-w-30 truncate',
		active
			? 'border-[rgb(var(--desktop-accent-rgb)/0.32)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)] text-(--desktop-text-primary)'
			: 'border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
	);
}

/** Origin / sort field chips. */
export function musicPlayerToolbarChipClass(active: boolean): string {
	return cn(
		MUSIC_PLAYER_TOOLBAR_CHIP_BASE,
		active
			? 'border-[rgb(var(--desktop-accent-rgb)/0.32)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)] text-(--desktop-text-primary)'
			: 'border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)'
	);
}

/** Soft outline buttons (queue, density, sort order). */
export const MUSIC_PLAYER_TOOLBAR_SOFT_BTN_CLASS = cn(
	MUSIC_PLAYER_TOOLBAR_CHIP_BASE,
	'inline-flex items-center gap-1 border-(--desktop-border-subtle)/80',
	'bg-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)'
);

export const MUSIC_PLAYER_DURATION_SORT_WARNING_CLASS = cn(
	'mt-1.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,transparent)] px-2.5 py-1.5',
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'leading-snug tracking-normal text-(--desktop-text-secondary)'
);
