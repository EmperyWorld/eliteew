/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact layout tokens for Content Manager explorer nested-folder grid tiles.
 *
 * Invariants:
 * - Dense row tiles (icon + name), not tall poster cards.
 * - Uses desktop CSS variables only.
 *
 * Related:
 * - ContentManagerExplorerNestedFoldersPanel.tsx
 * - documentation/product/CONTENT-MANAGER.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

/** Dense nested-folder grid — more columns, tighter gap. */
export const CM_NESTED_FOLDERS_GRID_CLASS = cn(
	'grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
);

/** Compact folder tile shell (horizontal). */
export const CM_NESTED_FOLDER_TILE_CLASS = cn(
	'group relative flex min-h-0 items-stretch overflow-hidden rounded-lg border border-l-4',
	'bg-(--desktop-surface-panel) p-1.5 text-left',
	'transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
	'hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong)'
);

export const CM_NESTED_FOLDER_OPEN_BTN_CLASS = cn(
	'flex min-h-0 min-w-0 flex-1 items-center gap-2 rounded-md px-0.5 py-0.5 text-left outline-none'
);

export const CM_NESTED_FOLDER_ICON_WRAP_CLASS = cn(
	'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
	'bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.16)]'
);

export const CM_NESTED_FOLDER_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'line-clamp-2 min-w-0 flex-1 font-medium leading-snug tracking-tight text-(--desktop-text-primary)'
);

export const CM_NESTED_FOLDER_MORE_BTN_CLASS = cn(
	'absolute top-1 right-1 h-6 w-6 opacity-0 transition',
	'group-hover:opacity-100 group-focus-within:opacity-100'
);
