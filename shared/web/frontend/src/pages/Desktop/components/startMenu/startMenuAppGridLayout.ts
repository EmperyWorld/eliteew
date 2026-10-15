/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P16 / Wave 1 Start grid density SSOT — catalog columns for All apps + search,
 * capped Home short-list columns, card name/meta classes, and keyboard-nav
 * column counts for StartMenuAppGrid (narrow-readable, not taskbar-micro).
 *
 * Invariants:
 * - Catalog viewport breakpoints match Tailwind `sm`/`md`/`lg`/`xl` on the grid.
 * - Narrow (below 640px) uses 2 columns + readable name token; meta line hides on max-sm.
 * - Full multi-column wall is for All apps / Home search results only.
 * - Home idle pinned/recent use {@link START_MENU_HOME_SHORT_GRID_CLASS} (≤3 cols).
 *
 * Related:
 * - StartMenuAppGrid.tsx, StartMenuHomeSurface.tsx, StartMenuLegacy.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';

/** Match Tailwind sm breakpoint used by Start catalog grid. */
export const START_MENU_APP_GRID_SM_MIN_PX = 640;
export const START_MENU_APP_GRID_MD_MIN_PX = 768;
export const START_MENU_APP_GRID_LG_MIN_PX = 1024;
export const START_MENU_APP_GRID_XL_MIN_PX = 1280;

/** All apps + Home search results — full catalog wall density. */
export const START_MENU_APP_GRID_CLASS =
	'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-1.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

/**
 * Home idle short lists (pinned/recent) — Wave 1 wide-density Cause.
 * Cap at 3 columns so a short list does not sprawl into a catalog wall on xl.
 */
export const START_MENU_HOME_SHORT_GRID_CLASS =
	'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-1.5';

export type StartMenuAppGridDensity = 'catalog' | 'home-short';

export function startMenuAppGridClassForDensity(
	density: StartMenuAppGridDensity
): string {
	return density === 'home-short'
		? START_MENU_HOME_SHORT_GRID_CLASS
		: START_MENU_APP_GRID_CLASS;
}

/** Readable catalog name (not taskbar 11px micro). */
export const START_MENU_APP_NAME_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'max-sm:text-sm font-medium text-(--desktop-text-primary)',
	'w-full text-left leading-tight line-clamp-2 break-words wrap-anywhere'
);

/** Description/category under name — hidden on narrow to reduce wall density. */
export const START_MENU_APP_META_CLASS = cn(
	DESKTOP_TYPOGRAPHY.small,
	'max-sm:hidden w-full text-left leading-snug text-(--desktop-text-muted) line-clamp-1'
);

export const START_MENU_APP_CARD_CLASS = cn(
	'relative flex min-h-0 flex-col gap-1.5 max-sm:gap-2 rounded-(--desktop-radius) p-2 max-sm:p-2.5 group',
	'border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_90%,var(--desktop-surface-panel)_10%)]',
	'hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)',
	'hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)]',
	'transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none'
);

/** All apps category stack: tighter on narrow so the wall scrolls less between sections. */
export const START_MENU_CATEGORIES_STACK_CLASS = 'space-y-5 max-sm:space-y-3';

export const START_MENU_CATEGORY_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.caption,
	'max-sm:hidden text-(--desktop-text-muted) mt-0.5 leading-snug'
);

/**
 * Keyboard arrow navigation column count — keep in lockstep with {@link START_MENU_APP_GRID_CLASS}.
 */
export function resolveStartMenuAppGridCols(viewportWidthPx: number): number {
	if (viewportWidthPx >= START_MENU_APP_GRID_XL_MIN_PX) return 6;
	if (viewportWidthPx >= START_MENU_APP_GRID_LG_MIN_PX) return 5;
	if (viewportWidthPx >= START_MENU_APP_GRID_MD_MIN_PX) return 4;
	if (viewportWidthPx >= START_MENU_APP_GRID_SM_MIN_PX) return 3;
	return 2;
}

/**
 * Keyboard cols for Home idle short grid — lockstep with {@link START_MENU_HOME_SHORT_GRID_CLASS}.
 */
export function resolveStartMenuHomeShortGridCols(
	viewportWidthPx: number
): number {
	if (viewportWidthPx >= START_MENU_APP_GRID_SM_MIN_PX) return 3;
	return 2;
}

export function resolveStartMenuAppGridColsForDensity(
	viewportWidthPx: number,
	density: StartMenuAppGridDensity
): number {
	return density === 'home-short'
		? resolveStartMenuHomeShortGridCols(viewportWidthPx)
		: resolveStartMenuAppGridCols(viewportWidthPx);
}
