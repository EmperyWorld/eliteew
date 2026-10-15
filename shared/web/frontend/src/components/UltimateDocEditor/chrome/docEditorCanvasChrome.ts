/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind tokens for Ultimate Doc Editor reading canvas (outer pad + TipTap paper).
 *
 * Invariants:
 * - Avoid stacked opaque panels: outer shell soft, TipTap wrapper glass paper (not second heavy frame).
 *
 * Related:
 * - chrome/UltimateDocEditorMainGrid.tsx, EditorCore/TiptapEditorInner.tsx
 * - utils/tiptapProseThemeClass.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';

/** Horizontal pad around the document canvas under the sticky toolbar. */
export const DOC_EDITOR_CANVAS_PAD_CLASS = cn('px-3 py-3 sm:px-4 sm:py-4');

/** Outer DesktopAppPanel shell wrapping load/error/markdown/TipTap states. */
export const DOC_EDITOR_CANVAS_SHELL_CLASS = cn(
	'min-h-[800px] overflow-hidden rounded-[var(--desktop-radius-lg)]',
	'border border-(--desktop-border-subtle)/55',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_48%,transparent)]',
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
);

/** Inner padding around TipTap / empty / error bodies. */
export const DOC_EDITOR_CANVAS_INNER_CLASS = cn(
	'relative min-h-[800px] p-4 sm:p-5 md:p-6'
);

/** TipTap DesktopAppPanel paper — quieter than default `panel` slab. */
export const DOC_EDITOR_TIPTAP_WRAPPER_CLASS = cn(
	'tiptap-editor-wrapper flex min-h-0 flex-col overflow-hidden',
	'rounded-[var(--desktop-radius-lg)]',
	'border border-(--desktop-border-subtle)/50',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_82%,transparent)]',
	// Overrides DesktopAppPanel soft drop shadow (className last + tailwind-merge).
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]'
);

/** Shared focus ring for ProseMirror root (softer than ring-2 + large offset). */
export const DOC_EDITOR_PROSE_FOCUS_CLASS = cn(
	'focus:outline-none',
	'focus-visible:ring-1 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/35',
	'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--desktop-surface-app)]',
	'motion-reduce:transition-none'
);
