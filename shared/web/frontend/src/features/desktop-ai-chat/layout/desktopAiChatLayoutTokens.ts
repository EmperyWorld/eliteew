/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout class tokens for Desktop AI Chat workspace surfaces (hero, panels, sidebar list, thread column).
 *
 * Invariants:
 * - Uses desktop CSS variables only; no hard-coded theme colors here.
 * - Sidebar meta labels stay sentence-case (no chrome uppercase shout).
 * - Thread column stays near-full width of `#desktop-ai-chat-messages` (no 42rem/60rem squeeze).
 *
 * Related:
 * - layout/DesktopAiChatWorkspaceHero.tsx
 * - components/DesktopAiChatSidebar.tsx
 * - components/DesktopAiChatMessagesPane.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 * ---
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/**
 * Message / document column inside the thread pane.
 * ~2cm gutter each side on large panes (`5rem` total → ~2.5rem/side ≈ 40px ≈ 1cm;
 * `8rem` total on lg+ → ~4rem/side ≈ 64px ≈ 1.7cm). No hard 42rem/60rem cap —
 * long expert/blueprint answers use the available window width.
 */
export const DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS = cn(
	'mx-auto w-full min-w-0',
	'max-w-[min(100%,calc(100%-3rem))]',
	'sm:max-w-[min(100%,calc(100%-5rem))]',
	'lg:max-w-[min(100%,calc(100%-8rem))]'
);

/** Above-the-fold hero strip for no-chat and onboarding states. */
export const DESKTOP_AI_CHAT_WORKSPACE_HERO_CLASS =
	'overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.16),transparent_36%),linear-gradient(135deg,rgb(var(--desktop-bg-primary-rgb)/0.14),rgb(var(--desktop-bg-primary-rgb)/0.04))] p-5 shadow-[var(--desktop-shadow-soft)]';

/** Scrollable chat list under search. */
export const DESKTOP_AI_CHAT_SIDEBAR_LIST_CLASS = cn(
	'flex-1 overflow-y-auto overscroll-y-contain px-2 pb-2.5 space-y-1'
);

/** Idle team/shared card — quiet hairline, not accent wash on every row. */
export const DESKTOP_AI_CHAT_SIDEBAR_TEAM_CARD_IDLE_CLASS = cn(
	'border border-(--desktop-border-subtle)/55',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)]',
	'hover:border-(--desktop-border-subtle)/80',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-soft))]'
);

/** Primary truncated chat title in the list. */
export const DESKTOP_AI_CHAT_SIDEBAR_TITLE_CLASS = cn(
	'block truncate font-medium tracking-tight text-(--desktop-text-primary)',
	DESKTOP_TYPOGRAPHY.shellCopy13
);

/** Pending-invites strip caption — sentence-case. */
export const DESKTOP_AI_CHAT_SIDEBAR_PENDING_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal text-[rgb(var(--desktop-accent-rgb)/0.92)]'
);

/** Shared-chat secondary chip — sentence-case, no uppercase shout. */
export const DESKTOP_AI_CHAT_SIDEBAR_SHARED_CHIP_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5',
	'font-medium tracking-normal text-(--desktop-text-secondary)',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.07)_100%,transparent)]'
);

/** Assistant/side secondary line under the title. */
export const DESKTOP_AI_CHAT_SIDEBAR_SECONDARY_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5',
	'tracking-normal text-(--desktop-text-secondary)'
);
