/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout / surface class tokens for Live Voice dock and floating card chrome.
 * Dock must paint opaque over wallpaper (no glass wash).
 *
 * Invariants:
 * - Dock shell/header/body use `rgb(var(--desktop-bg-*-rgb) / 1)` — never translucent
 *   `--desktop-surface-panel*` for the outer rail.
 * - Prefer these tokens over ad-hoc Tailwind soup in WidgetExpanded / pipeline shell.
 *
 * Related:
 * - WidgetExpanded.tsx, LiveVoiceDesktopPipeline.tsx
 * - documentation/product/VOICE-CONTROL-STUDIO.md
 * - pages/Desktop/components/DesktopAppChrome.tsx (focus ring peer)
 */

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

/** Fully opaque primary fill (taskbar opaque pattern). */
export const LIVE_VOICE_OPAQUE_PRIMARY =
	'bg-[rgb(var(--desktop-bg-primary-rgb)/1)]';

/** Fully opaque secondary strip (header / tabs / footer). */
export const LIVE_VOICE_OPAQUE_SECONDARY =
	'bg-[rgb(var(--desktop-bg-secondary-rgb)/1)]';

/** Soft inset cards on opaque secondary — still solid, not glass. */
export const LIVE_VOICE_OPAQUE_CARD = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	LIVE_VOICE_OPAQUE_SECONDARY
);

export const LIVE_VOICE_DOCK_SHELL = cn(
	'pointer-events-auto fixed bottom-0 right-0 top-0 flex w-full max-w-md flex-col',
	'border-l border-(--desktop-border-strong)',
	LIVE_VOICE_OPAQUE_PRIMARY,
	'text-(--desktop-text-primary)',
	'shadow-[-24px_0_64px_rgba(0,0,0,0.55)]'
);

export const LIVE_VOICE_PANEL_ROOT_DOCK = cn(
	'flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-none border-0 shadow-none',
	LIVE_VOICE_OPAQUE_PRIMARY
);

export const LIVE_VOICE_PANEL_ROOT_CARD = cn(
	'flex max-h-[80vh] w-[420px] max-w-full flex-col overflow-hidden',
	'rounded-(--desktop-radius-xl)',
	'border border-(--desktop-border-strong)',
	LIVE_VOICE_OPAQUE_PRIMARY,
	'shadow-[0_32px_84px_rgba(0,0,0,0.54)]'
);

export const LIVE_VOICE_HEADER = cn(
	'flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle)',
	'px-4 py-3 sm:px-5',
	LIVE_VOICE_OPAQUE_SECONDARY
);

/** Record-tab hero: mic CTA centered, short hint — no operator instruction card. */
export const LIVE_VOICE_RECORD_HERO = cn(
	'flex flex-col items-center justify-center gap-5 py-6 text-center sm:py-8'
);

export const LIVE_VOICE_TURN_CARD = cn(
	LIVE_VOICE_OPAQUE_CARD,
	'px-3.5 py-3 text-left'
);

export const LIVE_VOICE_TABLIST = cn(
	'flex border-b border-(--desktop-border-subtle)',
	LIVE_VOICE_OPAQUE_SECONDARY
);

export const LIVE_VOICE_TAB = cn(
	'relative flex flex-1 items-center justify-center gap-2 px-3 py-2.5',
	'text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const LIVE_VOICE_BODY = cn(
	'flex-1 overflow-y-auto text-(--desktop-text-primary)',
	LIVE_VOICE_OPAQUE_PRIMARY
);

export const LIVE_VOICE_FOOTER = cn(
	'border-t border-(--desktop-border-subtle) px-4 py-2.5 sm:px-5',
	LIVE_VOICE_OPAQUE_SECONDARY
);

export const LIVE_VOICE_ICON_BADGE = cn(
	'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--desktop-radius-lg)',
	'border border-[rgb(var(--desktop-accent-rgb)/0.35)]',
	'bg-[rgb(var(--desktop-accent-rgb)/0.14)]',
	'text-[rgb(var(--desktop-accent-rgb))]'
);

export const LIVE_VOICE_ICON_BUTTON = cn(
	'rounded-(--desktop-radius) p-1.5 text-(--desktop-text-muted)',
	'transition-colors duration-200 motion-reduce:transition-none',
	'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const LIVE_VOICE_POWER_TRACK = cn(
	'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
	'transition-colors duration-200 motion-reduce:transition-none',
	DESKTOP_CHROME_FOCUS_VISIBLE
);
