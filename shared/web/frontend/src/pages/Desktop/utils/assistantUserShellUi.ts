/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Пользовательские классы Справочника: accent и surface tokens рабочего стола, без operator amber/rose.
 *
 * Invariants:
 * - CSS-переменные наследуются от `#desktop-main` / DesktopAppContentWrapper.
 * - Author chips use sentence-case shell meta (no uppercase shout).
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - pages/Desktop/components/assistant/AssistantChatMessageBubble.tsx
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */

import { cn } from '@/utils/cn';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_TYPOGRAPHY } from '../constants';

/** Успех (копирование, «помогло») — читаемо в light/dark shell. */
export function assistantSuccessIconClass(theme: DesktopShellTheme): string {
	return theme === 'light' ? 'text-emerald-700' : 'text-emerald-300/95';
}

/** Подсказка / вторичный статус в баннерах. */
export function assistantHintTextClass(theme: DesktopShellTheme): string {
	return theme === 'light'
		? 'text-(--desktop-text-muted)'
		: 'text-(--desktop-text-dim)';
}

/** Ответ из блока «Частые вопросы» — accent shell. */
export const ASSISTANT_FAQ_HINT_BUBBLE_CLASS = cn(
	'relative overflow-hidden',
	'border border-dashed border-(--desktop-border-subtle)/80',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.48)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-panel))]',
	'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-white/12'
);

export const ASSISTANT_MESSAGE_AUTHOR_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex items-center rounded-full border border-(--desktop-border-subtle)/55',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_55%,transparent)]',
	'px-2 py-0.5 font-medium tracking-normal text-(--desktop-text-dim)'
);

export const ASSISTANT_MESSAGE_AUTHOR_ASSISTANT_CLASS = cn(
	ASSISTANT_MESSAGE_AUTHOR_CLASS,
	'border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-panel))]',
	'text-[rgb(var(--desktop-accent-rgb)/0.92)]'
);

export const ASSISTANT_USER_BUBBLE_SHELL_CLASS = cn(
	'relative overflow-hidden',
	'border border-[rgb(var(--desktop-accent-rgb)/0.22)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-panel))]',
	'shadow-[0_1px_0_color-mix(in_srgb,var(--desktop-border-subtle)_55%,transparent)]',
	'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-white/10'
);

export const ASSISTANT_ASSISTANT_BUBBLE_SHELL_CLASS = cn(
	'relative overflow-hidden',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.5)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb)/0.04))]',
	'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]',
	'ring-1 ring-inset ring-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
	'before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:rounded-full before:bg-white/14'
);
export const ASSISTANT_STREAMING_THINKING_CLASS = cn(
	'inline-flex items-center gap-2 text-xs text-(--desktop-text-muted)'
);

export const ASSISTANT_FAQ_SIDEBAR_HINT_DOT_CLASS =
	'h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] ring-2 ring-(--desktop-surface-panel)';

export const ASSISTANT_FAQ_COUNT_BADGE_SHELL_CLASS = cn(
	'border border-[rgb(var(--desktop-accent-rgb)/0.22)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-panel))]',
	'text-[rgb(var(--desktop-accent-rgb)/0.92)]'
);
