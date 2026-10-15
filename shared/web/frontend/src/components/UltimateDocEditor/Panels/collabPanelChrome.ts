/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium chrome tokens for Ultimate Doc Editor Collaboration side panel.
 *
 * Invariants:
 * - Section headings stay sentence-case (no uppercase shout).
 * - Uses desktop CSS variables only.
 *
 * Related:
 * - Panels/CollaborationPanel.tsx
 * - documentation/product/DOC-EDITOR-COLLABORATION.md
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export const DOC_EDITOR_COLLAB_SHELL_CLASS = cn(
	'collab-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-96 max-w-[calc(100vw-1rem)] flex-col overflow-hidden',
	'border-l border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(var(--desktop-bg-primary-rgb))_8%)]',
	'shadow-(--desktop-shadow-panel) backdrop-blur-2xl'
);

export const DOC_EDITOR_COLLAB_HEADER_CLASS = cn(
	'shrink-0 border-b border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)] px-3 py-2.5'
);

export const DOC_EDITOR_COLLAB_HEADER_ICON_CLASS = cn(
	'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
	'border border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
);

export const DOC_EDITOR_COLLAB_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'truncate font-semibold tracking-tight text-(--desktop-text-primary)'
);

export const DOC_EDITOR_COLLAB_SUBTITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'leading-snug tracking-normal text-(--desktop-text-muted)'
);

export const DOC_EDITOR_COLLAB_STATUS_STRIP_CLASS = cn(
	'flex flex-wrap items-center gap-2 border-b border-(--desktop-border-subtle)/70 px-3 py-2',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

/** Incoming / invite section titles — sentence-case body weight. */
export const DOC_EDITOR_COLLAB_SECTION_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'mb-2 flex items-center gap-2 font-semibold tracking-tight text-(--desktop-text-primary)'
);

/** Participants / activity captions — quiet meta, no uppercase. */
export const DOC_EDITOR_COLLAB_META_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'flex items-center gap-2 font-medium tracking-normal text-(--desktop-text-muted)'
);

export const DOC_EDITOR_COLLAB_BODY_CLASS = cn(
	'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain',
	'[-webkit-overflow-scrolling:touch] custom-scrollbar'
);

export const DOC_EDITOR_COLLAB_SECTION_CLASS = cn(
	'border-b border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_82%,transparent)] p-3'
);
