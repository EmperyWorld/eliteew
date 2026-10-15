/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium chrome tokens for Ultimate Doc Editor AI Assistant side panel.
 *
 * Invariants:
 * - No purple accent wash; desktop CSS variables / accent rgb only.
 * - Meta copy stays sentence-case (no uppercase shout).
 *
 * Related:
 * - Panels/aiAssistant/AIAssistantHeader.tsx, AIAssistantToolbar.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export const DOC_EDITOR_AI_HEADER_PAD_CLASS = cn('shrink-0 px-3 py-2.5');

export const DOC_EDITOR_AI_HEADER_ICON_CLASS = cn(
	'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
	'border border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
);

export const DOC_EDITOR_AI_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellCopy13,
	'truncate font-semibold tracking-tight text-(--desktop-text-primary)'
);

export const DOC_EDITOR_AI_SUBTITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'leading-snug tracking-normal text-(--desktop-text-muted)'
);

export const DOC_EDITOR_AI_TOOLBAR_PAD_CLASS = cn('shrink-0 px-3 py-2');

export const DOC_EDITOR_AI_META_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'tracking-normal text-(--desktop-text-dim)'
);

export const DOC_EDITOR_AI_QUICK_ACTION_CLASS = cn(
	'min-h-8 gap-1 px-2 py-1',
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal'
);

export const DOC_EDITOR_AI_CHAT_SCROLL_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto overscroll-contain p-3',
	'[-webkit-overflow-scrolling:touch] custom-scrollbar'
);

export const DOC_EDITOR_AI_EMPTY_ICON_CLASS =
	'mx-auto text-(--desktop-text-muted)';
