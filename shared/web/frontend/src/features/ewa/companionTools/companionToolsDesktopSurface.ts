/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop surface classes for companion tools menus (opaque catalog panel vs compact popovers).
 *
 * Invariants:
 * - Catalog panel uses **solid** ``rgb(var(--desktop-bg-*-rgb))`` — no alpha gradients on body portal.
 * - Parent portal must apply ``getDesktopPortalShellProps()`` (see CompanionToolsCatalogPortal / ShellPortalMount).
 *
 * Related:
 * - src/pages/Desktop/utils/desktopVisualSystem.tsx
 * - src/features/ewa/companionTools/CompanionToolsCatalogPortal.tsx
 */

import type { DesktopWindowStyle } from '@/types/profile';
import { getGafChatOverflowMenuSurfaceClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

/** Small dropdown in quick-preset strip — flat GAF overflow menu. */
export function getCompanionToolsPopoverSurfaceClassName(
	windowStyle: DesktopWindowStyle
): string {
	return getGafChatOverflowMenuSurfaceClassName(windowStyle);
}

/** Opaque catalog shell (requires desktop portal CSS vars on ancestor). */
export const COMPANION_TOOL_CATALOG_PANEL_SURFACE_CLASS = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-strong)',
	'bg-[rgb(var(--desktop-bg-secondary-rgb))]',
	'shadow-(--desktop-shadow-panel) isolate overflow-hidden'
);

export const COMPANION_TOOL_CATALOG_HEADER_CLASS = cn(
	'flex shrink-0 items-center justify-between gap-2',
	'border-b border-(--desktop-border-subtle)',
	'bg-[rgb(var(--desktop-bg-secondary-rgb))] px-3 py-2'
);

export const COMPANION_TOOL_CATALOG_BODY_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-2.5 py-2',
	'bg-[rgb(var(--desktop-bg-primary-rgb))]',
	'[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-(--desktop-border-subtle)'
);

/** Sheet / wide layout — roomier padding. */
export const COMPANION_TOOL_CATALOG_BODY_SHEET_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-3.5 py-3',
	'bg-[rgb(var(--desktop-bg-primary-rgb))]',
	'[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-(--desktop-border-subtle)'
);

/** Anchored popover width — match composer, room for descriptions and actions. */
export const COMPANION_TOOLS_ANCHORED_MAX_WIDTH_PX = 440;

export const COMPANION_TOOL_CATALOG_SECTION_TITLE_CLASS =
	'mb-1.5 text-[12px] font-semibold text-(--desktop-text-primary)';

export const COMPANION_TOOL_CATALOG_SECTION_TITLE_SHEET_CLASS =
	'mb-2 text-[13px] font-semibold text-(--desktop-text-primary)';
export const COMPANION_TOOL_CHIP_SURFACE_CLASS = cn(
	'inline-flex max-w-[min(11rem,42vw)] shrink-0 items-stretch overflow-hidden rounded-full',
	'border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft)',
	'shadow-[var(--desktop-shadow-soft)]'
);

export const COMPANION_TOOL_CHIP_ACTION_CLASS = cn(
	'inline-flex min-w-0 items-center gap-1 px-2 py-1',
	'bg-transparent text-[10px] font-medium leading-tight',
	'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover)',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const COMPANION_TOOL_CHIP_ICON_ACTION_CLASS = cn(
	'inline-flex shrink-0 items-center justify-center border-l',
	'border-(--desktop-border-subtle) px-1',
	'bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
	'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const COMPANION_TOOL_CATALOG_ICON_TILE_CLASS = cn(
	'flex shrink-0 items-center justify-center rounded-lg border',
	'size-9 border-(--desktop-border-subtle) bg-[rgb(var(--desktop-bg-primary-rgb))]'
);

/** Compact anchored popover row — single line actions, no card chrome. */
export const COMPANION_TOOL_CATALOG_ROW_COMPACT_CLASS = cn(
	'group flex items-center gap-2 rounded-lg px-1.5 py-1',
	'transition-colors duration-150',
	'hover:bg-[rgb(var(--desktop-bg-secondary-rgb))]'
);

/** Sheet / touch — card layout with comfortable tap targets. */
export const COMPANION_TOOL_CATALOG_ROW_SHEET_CLASS = cn(
	'flex flex-col gap-2.5 rounded-xl border p-3',
	'border-(--desktop-border-subtle) bg-[rgb(var(--desktop-bg-secondary-rgb))]',
	'transition-[border-color,background-color] duration-150',
	'hover:border-(--desktop-border-strong)'
);

export const COMPANION_TOOL_CATALOG_SEARCH_CLASS = cn(
	'w-full rounded-lg border py-1.5 pl-7 pr-2.5',
	'border-(--desktop-border-subtle) bg-[rgb(var(--desktop-bg-primary-rgb))]',
	'text-[12px] text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted)',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const COMPANION_TOOL_CATALOG_HINT_CLASS = cn(
	'text-[12px] leading-relaxed text-(--desktop-text-secondary)'
);

export const COMPANION_TOOL_CATALOG_ACTION_BASE_CLASS = cn(
	'rounded-md border px-2 py-0.5 text-[10px] font-medium leading-tight transition-colors',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const COMPANION_TOOL_CATALOG_INSERT_ACTION_CLASS = cn(
	COMPANION_TOOL_CATALOG_ACTION_BASE_CLASS,
	'border-(--desktop-border-subtle) bg-[rgb(var(--desktop-bg-primary-rgb))] text-(--desktop-text-secondary)',
	'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
);

export const COMPANION_TOOL_CATALOG_TRY_ACTION_CLASS = cn(
	COMPANION_TOOL_CATALOG_ACTION_BASE_CLASS,
	'min-w-[5.5rem] border-[rgb(var(--desktop-accent-rgb)/0.35)] px-2.5 py-1 text-[11px]',
	'bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)',
	'hover:bg-[rgb(var(--desktop-accent-rgb)/0.22)]'
);
