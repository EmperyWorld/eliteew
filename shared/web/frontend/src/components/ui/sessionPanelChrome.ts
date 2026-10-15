/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout class tokens for the Desktop «Сессия и устройство» floating panel
 * (`AuthStatusIndicator` expanded chrome).
 *
 * Invariants:
 * - Meta labels stay sentence-case (no chrome uppercase shout).
 * - Uses desktop CSS variables only.
 *
 * Related:
 * - components/ui/AuthStatusIndicator.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

/** Expanded floating panel shell — quiet hairline, soft depth. */
export const SESSION_PANEL_SHELL_CLASS = cn(
	'relative isolate flex max-h-[min(72vh,calc(100dvh-7rem))] w-[min(400px,calc(100vw-1rem))] flex-col overflow-hidden',
	'rounded-2xl border border-(--desktop-border-subtle)',
	'bg-[linear-gradient(160deg,rgb(var(--desktop-bg-primary-rgb))_0%,rgb(var(--desktop-bg-secondary-rgb))_100%)]',
	'text-(--desktop-text-primary)',
	'shadow-[0_16px_40px_rgba(0,0,0,0.38)]'
);

export const SESSION_PANEL_HEADER_CLASS = cn(
	'flex shrink-0 items-center gap-2.5 border-b border-(--desktop-border-subtle) px-3 py-2.5'
);

export const SESSION_PANEL_BODY_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-contain p-3';

export const SESSION_PANEL_FOOTER_CLASS = cn(
	'shrink-0 space-y-1.5 border-t border-(--desktop-border-subtle) p-2.5'
);

/** Credits / metric captions — sentence-case, quiet meta. */
export const SESSION_PANEL_META_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal text-(--desktop-text-muted)'
);

export const SESSION_PANEL_STATUS_LINE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'truncate tracking-normal text-(--desktop-text-muted)'
);

/** Profile / credits identity card. */
export const SESSION_PANEL_IDENTITY_CARD_CLASS = cn(
	'flex items-center gap-2.5 rounded-xl border border-(--desktop-border-subtle)/70',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-secondary-rgb))_72%,transparent)] p-2.5'
);

/** Compact status chip under identity (role / account). */
export const SESSION_PANEL_CHIP_CLASS = cn(
	'rounded-md border border-(--desktop-border-subtle)/60',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-secondary-rgb))_55%,transparent)]',
	'px-2 py-0.5 text-(--desktop-text-secondary)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

/** 2×2 health metric tile. */
export const SESSION_PANEL_METRIC_TILE_CLASS = cn(
	'rounded-lg border border-(--desktop-border-subtle)/60',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-secondary-rgb))_58%,transparent)]',
	'px-2.5 py-2'
);
