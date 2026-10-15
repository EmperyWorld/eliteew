/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind tokens for Ultimate Doc Editor left panel icon rail.
 *
 * Invariants:
 * - Column stays 44px-wide icon stack; section dividers are short hairlines (not full-width slabs).
 *
 * Related:
 * - chrome/EditorPanelSidebar.tsx, UltimateDocEditorMainGrid.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';

/** Outer grid column when not using shell `shellNavRail` preset. */
export const DOC_EDITOR_SIDEBAR_OUTER_CLASS = cn(
	'border-r border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_72%,transparent)]',
	'shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]'
);

/** Inner 44px icon stack (`EditorPanelSidebar` root). */
export const DOC_EDITOR_SIDEBAR_COLUMN_CLASS = cn(
	'flex w-[44px] min-w-[44px] shrink-0 flex-col items-center gap-1 px-1 py-2.5'
);

/** Short centered hairline between sidebar sections. */
export const DOC_EDITOR_SIDEBAR_SECTION_DIVIDER_CLASS = cn(
	'mx-auto my-1.5 h-px w-5 shrink-0',
	'bg-[color-mix(in_srgb,var(--desktop-border-subtle)_52%,transparent)]'
);

/** Idle / closed panel rail icon button. */
export const DOC_EDITOR_SIDEBAR_ICON_BUTTON_CLASS = cn(
	'h-8 w-8 shrink-0 rounded-lg',
	'text-(--desktop-text-secondary)',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)]',
	'hover:text-(--desktop-text-primary)'
);

/** Open panel rail icon button (quieter than full accent slab). */
export const DOC_EDITOR_SIDEBAR_ICON_BUTTON_ACTIVE_CLASS = cn(
	'h-8 w-8 shrink-0 rounded-lg',
	'border border-[rgb(var(--desktop-accent-rgb))]/40',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb))]',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
);

/** Voice dictate busy (recording / transcribing). */
export const DOC_EDITOR_SIDEBAR_VOICE_BUSY_CLASS = cn(
	'h-8 w-8 shrink-0 rounded-lg',
	'border border-red-400/45 bg-red-950/45 text-red-100',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
);
