/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium chrome tokens for Ultimate Doc Editor File Manager side panel.
 *
 * Invariants:
 * - Section / sort meta stays sentence-case (no uppercase shout).
 * - Uses desktop CSS variables only.
 *
 * Related:
 * - Panels/fileManager/FileManagerPanel.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-FILE-MANAGER.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/** Panel shell (fixed right drawer). */
export const DOC_EDITOR_FILE_MANAGER_SHELL_CLASS = cn(
	'file-manager-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-[420px] min-w-0 flex-col',
	'border-l border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(var(--desktop-bg-primary-rgb))_8%)]',
	'shadow-(--desktop-shadow-panel) backdrop-blur-2xl'
);

export const DOC_EDITOR_FILE_MANAGER_HEADER_CLASS = cn(
	'shrink-0 border-b border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)] px-3 py-2'
);

export const DOC_EDITOR_FILE_MANAGER_HEADER_ICON_CLASS = cn(
	'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
	'border border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
);

export const DOC_EDITOR_FILE_MANAGER_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'truncate font-semibold tracking-tight text-(--desktop-text-primary)'
);

export const DOC_EDITOR_FILE_MANAGER_ACTIONS_CLASS = cn(
	'shrink-0 space-y-1.5 border-b border-(--desktop-border-subtle)/70 px-3 py-2'
);

export const DOC_EDITOR_FILE_MANAGER_SORT_CLASS = cn(
	'shrink-0 space-y-1.5 border-b border-(--desktop-border-subtle)/70 px-3 py-2'
);

/** Sort / recent / all-documents captions — sentence-case meta. */
export const DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal text-(--desktop-text-muted)'
);

export const DOC_EDITOR_FILE_MANAGER_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'leading-snug tracking-normal text-(--desktop-text-dim)'
);

export const DOC_EDITOR_FILE_MANAGER_LIST_CLASS = cn(
	'min-h-0 min-w-0 flex-1 overflow-y-auto px-2.5 pb-2 pt-1.5 custom-scrollbar'
);

export const DOC_EDITOR_FILE_MANAGER_RECENT_CARD_CLASS = cn(
	'rounded-lg border border-(--desktop-border-subtle)/55',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_72%,transparent)] p-1.5'
);

export const DOC_EDITOR_FILE_MANAGER_FOOTER_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'flex min-w-0 shrink-0 items-center justify-between gap-2',
	'border-t border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)] px-3 py-1.5',
	'tracking-normal text-(--desktop-text-muted)'
);
