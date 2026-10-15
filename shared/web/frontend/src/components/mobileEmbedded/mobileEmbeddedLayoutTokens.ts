/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tailwind layout tokens for `#/mobile-*` embedded SPA shells inside MobileAndroid WebView.
 *
 * Invariants:
 * - Colors/spacing align with native `MobileEmbeddedSpaChrome.kt` + `PremiumGlass.kt` / `MobileDesignTokens.kt`.
 * - CSS variables `--me-*` are defined in `mobileEmbeddedTheme.css` on the shell root.
 *
 * Related:
 * - MobileEmbeddedShell.tsx, mobileEmbeddedTheme.css
 * - features/friends/social-hub/layout/SocialHubMobileSegmentNav.tsx
 * - features/ewa/EwaCompanionChatPanel.tsx, pages/Desktop/components/AssistantApp.tsx
 * - pages/MobileHandbook/MobileHandbookPage.tsx (`#/mobile-handbook`)
 */

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

/** PremiumGlass-style panel gradient (22dp radius, 16dp pad). */
export const MOBILE_EMBEDDED_GLASS_PANEL_CLASS = cn(
	'rounded-[22px] border border-white/[0.52]',
	'bg-[linear-gradient(165deg,color-mix(in_srgb,var(--me-surface-panel)_58%,transparent)_0%,color-mix(in_srgb,var(--me-surface)_72%,transparent)_100%)]',
	'shadow-[var(--me-shadow-panel)] backdrop-blur-[6px]'
);

/** Full-viewport shell (native Android toolbar owns close; title optional per route). */
export const MOBILE_EMBEDDED_SHELL_CLASS = cn(
	'flex h-dvh max-h-dvh min-h-0 w-full flex-col overflow-hidden touch-manipulation',
	'bg-(--me-bg) text-(--me-text-primary) antialiased'
);

export const MOBILE_EMBEDDED_BODY_CLASS = cn(
	'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
	'pb-[max(0.25rem,env(safe-area-inset-bottom))]'
);

/** App root — 16dp horizontal rhythm (native list padding). */
export const MOBILE_EMBEDDED_APP_ROOT_CLASS = cn(
	'flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3'
);

export const MOBILE_EMBEDDED_MAIN_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-4'
);

export const MOBILE_EMBEDDED_PANEL_CLASS = cn(
	MOBILE_EMBEDDED_GLASS_PANEL_CLASS,
	'p-4'
);

export const MOBILE_EMBEDDED_SEGMENT_RAIL_CLASS = cn(
	'flex w-full gap-1 overflow-x-auto overscroll-x-contain rounded-[18px]',
	'border border-(--me-border-subtle) bg-[color-mix(in_srgb,var(--me-surface-soft)_55%,transparent)] p-1',
	'scrollbar-thin'
);

export function mobileEmbeddedSegmentItemClass(active: boolean): string {
	return cn(
		'inline-flex min-h-11 min-w-[4.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] px-2 py-1.5 text-[11px] font-semibold leading-tight',
		'motion-safe:transition-colors motion-reduce:transition-none',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		active
			? 'bg-[rgb(var(--me-accent-rgb))]/14 text-(--me-text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
			: 'text-(--me-text-muted) hover:bg-[color-mix(in_srgb,var(--me-surface-soft)_80%,transparent)] hover:text-(--me-text-secondary)'
	);
}

export const MOBILE_EMBEDDED_CONTEXT_PILL_CLASS = cn(
	'inline-flex max-w-full items-center gap-2 self-start rounded-full',
	'border border-(--me-border-subtle) bg-[color-mix(in_srgb,var(--me-surface-soft)_55%,transparent)] px-3 py-1',
	'text-[11px] font-medium text-(--me-text-secondary)'
);

export const MOBILE_EMBEDDED_REQUESTS_BANNER_CLASS = cn(
	'flex w-full items-center justify-between gap-2 rounded-[18px]',
	'border border-[rgb(var(--me-accent-rgb))]/30 bg-[rgb(var(--me-accent-rgb))]/10 px-3 py-2.5'
);

/** Compact in-app header strip (Handbook, optional SPA chrome). */
export const MOBILE_EMBEDDED_COMPACT_HEADER_CLASS = cn(
	'border-b border-(--me-border-faint)',
	'bg-[color-mix(in_srgb,var(--me-surface)_92%,transparent)]'
);

/** Handbook (`#/mobile-handbook`): full-height flex root inside embedded shell. */
export const MOBILE_EMBEDDED_HANDBOOK_ROOT_CLASS = cn(
	'flex h-full min-h-0 flex-1 flex-col overflow-hidden'
);

/** FAQ expand chip in chat column — always visible in wide WebView (no `md:hidden`). */
export const MOBILE_EMBEDDED_HANDBOOK_FAQ_CHIP_CLASS = cn(
	'flex w-full rounded-lg border border-dashed border-(--me-border-subtle)',
	'border-l-[3px] border-l-[rgb(var(--me-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,var(--me-surface-soft)_55%,transparent)]',
	'px-3 py-2 text-left text-[13px] leading-snug font-medium',
	'text-(--me-text-secondary) hover:text-(--me-text-primary)',
	'hover:border-[rgb(var(--me-accent-rgb)/0.32)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--me-accent-rgb))_6%,var(--me-surface-soft))]',
	'motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200',
	'hover:shadow-sm',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

/** Chat column: thread scroll + composer pinned to bottom. */
export const MOBILE_EMBEDDED_HANDBOOK_CHAT_COLUMN_CLASS = cn(
	'flex min-h-0 min-w-0 flex-1 flex-col'
);

/** Icon-only send/stop on embedded handbook composer (2.75rem touch). */
export const MOBILE_EMBEDDED_HANDBOOK_COMPOSER_SEND_CLASS = cn(
	'h-11 w-11 min-h-11 min-w-11 shrink-0 p-0 [&_svg]:size-4',
	'[&_span:not(.sr-only)]:hidden'
);

/** EWA companion (`#/mobile-ewa-companion`): transcript + composer only, no stacked meta rails. */
export const MOBILE_EMBEDDED_EWA_PRESENCE_ROOT_CLASS = cn(
	'flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2 pb-1.5'
);

/** Compact horizontal presence row (sigil + name). */
export const MOBILE_EMBEDDED_EWA_PRESENCE_HEADER_CLASS = cn(
	MOBILE_EMBEDDED_GLASS_PANEL_CLASS,
	'relative flex shrink-0 flex-row items-center gap-2 px-2.5 py-1.5'
);

export const MOBILE_EMBEDDED_EWA_SIGIL_CLASS = cn(
	'shrink-0 [&_.companion-presence-sigil-wrapper]:size-12 [&_svg]:size-12'
);

export const MOBILE_EMBEDDED_EWA_ROLE_LINE_CLASS = cn(
	'line-clamp-1 text-[10px] font-medium leading-snug text-(--me-text-muted)'
);

export const MOBILE_EMBEDDED_EWA_TRANSCRIPT_CLASS = cn(
	'min-h-0 flex-1 rounded-[22px]'
);

export const MOBILE_EMBEDDED_EWA_COMPOSER_CLASS = cn(
	'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
);

/** Action buttons in a horizontal row above the textarea. */
export const MOBILE_EMBEDDED_EWA_COMPOSER_TOOLBAR_CLASS = cn(
	'flex w-full flex-wrap items-center gap-1 overflow-x-auto overscroll-x-contain',
	'pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
);

export const MOBILE_EMBEDDED_EWA_COMPOSER_TOOL_BUTTON_CLASS = cn(
	'h-10 w-10 min-h-10 min-w-10 shrink-0 p-0 [&_svg]:size-4'
);

export const MOBILE_EMBEDDED_EWA_QUICK_ACTION_ICON_CLASS = cn(
	'min-h-10 min-w-10 shrink-0 justify-center gap-0 px-0',
	'[&_span:not(.sr-only):not([aria-hidden])]:hidden'
);

/** Assistant reply bubble — full transcript width, min height for short lines. */
export const MOBILE_EMBEDDED_EWA_ASSISTANT_BUBBLE_CLASS = cn(
	'mr-auto w-full max-w-full min-h-14 py-3',
	'border-(--companion-divider) bg-white/6'
);

/** First-meet legend choice tiles — always single column in embedded WebView (wide CSS viewport). */
export const MOBILE_EMBEDDED_EWA_FIRST_MEET_CHOICE_GRID_CLASS = cn(
	'grid grid-cols-1 gap-2.5'
);

/** Phone landscape: transcript + composer side-by-side (U5.4). */
export const MOBILE_EMBEDDED_EWA_LANDSCAPE_CHAT_ROW_CLASS = cn(
	'flex min-h-0 flex-1 flex-row items-stretch gap-2'
);

export const MOBILE_EMBEDDED_EWA_LANDSCAPE_TRANSCRIPT_CLASS = cn(
	'min-h-0 min-w-0 flex-1'
);

/** Right column: composer toolbar + textarea + quick presets. */
export const MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_STACK_CLASS = cn(
	'flex min-h-0 w-[min(42%,16.5rem)] shrink-0 flex-col gap-1.5 overflow-hidden'
);

export const MOBILE_EMBEDDED_EWA_LANDSCAPE_COMPOSER_CLASS = cn(
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain'
);

export const MOBILE_EMBEDDED_EWA_LANDSCAPE_HEADER_CLASS = cn(
	'py-1 [&_.companion-presence-sigil-wrapper]:size-10 [&_svg]:size-10'
);
