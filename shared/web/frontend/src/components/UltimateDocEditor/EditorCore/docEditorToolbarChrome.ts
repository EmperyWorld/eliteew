/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind tokens for Ultimate Doc Editor sticky formatting toolbar chrome.
 *
 * Invariants:
 * - Sticky strip stays glass fade (no opaque slab); icon hover has no translate bounce.
 *
 * Related:
 * - UltimateDocEditorMainGrid.tsx, EditorToolbar.tsx, EditorToolbarIconButton.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';

/** Sticky fade over the editor scroll surface (`data-doc-guide="editor-toolbar-sticky"`). */
export const DOC_EDITOR_TOOLBAR_STICKY_CLASS = cn(
	'sticky top-0 px-4 pb-2.5 pt-2',
	'bg-linear-to-b from-[color-mix(in_srgb,var(--desktop-surface-app)_96%,transparent)]',
	'via-[color-mix(in_srgb,var(--desktop-surface-app)_78%,transparent)] to-transparent',
	'backdrop-blur-[6px]',
	'supports-backdrop-filter:from-[color-mix(in_srgb,var(--desktop-surface-app)_88%,transparent)]',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]'
);

/** Outer EditorToolbar shell (frame className from MainGrid may layer on top). */
export const DOC_EDITOR_TOOLBAR_SHELL_CLASS = cn(
	'editor-toolbar relative mx-auto min-w-0 rounded-xl',
	'border border-(--desktop-border-subtle)/65',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_76%,transparent)]',
	'px-2.5 py-1.5 shadow-none backdrop-blur-md sm:px-3 sm:py-2',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
);

/** Fieldset cluster around related icon buttons. */
export const DOC_EDITOR_TOOLBAR_GROUP_CLASS = cn(
	'm-0 flex min-w-0 shrink-0 items-center gap-0.5 rounded-lg',
	'border border-(--desktop-border-subtle)/50',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_68%,transparent)]',
	'px-1 py-0.5 shadow-none backdrop-blur-sm'
);

/** Base chrome for toolbar icon buttons (active/disabled layered by caller). */
export const DOC_EDITOR_TOOLBAR_ICON_BUTTON_CLASS = cn(
	'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
	'border border-(--desktop-border-subtle)/60 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,transparent)]',
	'text-(--desktop-text-secondary) backdrop-blur-sm',
	'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none',
	'hover:border-[rgb(var(--desktop-accent-rgb))]/40',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,var(--desktop-surface-soft))]',
	'hover:text-(--desktop-text-primary)'
);

export const DOC_EDITOR_TOOLBAR_ICON_BUTTON_ACTIVE_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb))]/65 bg-(--desktop-surface-accent) text-white',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-[rgb(var(--desktop-accent-rgb))]/45 ring-inset'
);

/** Heading glyph labels (H4–H6) — compact tabular, not shout tracking. */
export const DOC_EDITOR_TOOLBAR_HEADING_GLYPH_CLASS = cn(
	'text-[10px] font-semibold tabular-nums tracking-tight'
);
