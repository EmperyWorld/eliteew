/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tailwind class tokens for AssistantApp header chrome and overflow menu.
 *
 * Invariants:
 * - Presentational only; no runtime logic.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantAppHeader.tsx
 * - pages/Desktop/components/assistant/assistantChatPanelStyles.ts
 */
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	ASSISTANT_STREAMING_BAR_CLASS,
	ASSISTANT_STREAMING_BAR_INNER_CLASS,
} from './assistantChatPanelStyles';

export const ASSISTANT_HEADER_STREAMING_BAR_CLASS = cn(
	ASSISTANT_STREAMING_BAR_CLASS,
	'h-1'
);

export const ASSISTANT_HISTORY_ERROR_REFRESH_CLASS = cn(
	'text-rose-300/90 hover:text-rose-100 hover:bg-rose-500/10'
);

export const ASSISTANT_HEADER_EXPORT_BUTTON_CLASS = cn(
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
);

export const ASSISTANT_HISTORY_REFRESH_READY_CLASS = cn(
	'group/hist-refresh',
	'[&_svg]:motion-safe:group-hover/hist-refresh:rotate-180',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-300',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_HISTORY_REFRESH_SUCCESS_CLASS = cn(
	'text-emerald-200/95 bg-emerald-500/10',
	'hover:text-emerald-200/95 hover:bg-emerald-500/10'
);

export const ASSISTANT_CLEAR_LOCAL_FAQ_BUTTON_CLASS = cn(
	'gap-1.5 text-(--desktop-text-secondary)',
	'hover:text-amber-100/95 hover:bg-amber-500/10',
	'motion-safe:hover:ring-1 motion-safe:hover:ring-amber-400/35',
	'motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_HEADER_TAGLINE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.body,
	'leading-snug tracking-tight text-pretty',
	'font-normal text-(--desktop-text-secondary)',
	'line-clamp-1 md:line-clamp-2 md:max-w-xl',
	'border-l-2 border-l-[rgb(var(--desktop-accent-rgb)/0.35)] pl-2.5',
	'transition-[border-color,color] duration-200 motion-reduce:transition-none'
);

/** Desktop toolbar message-count chip — quiet meta, not shouty abbrev dump. */
export const ASSISTANT_HEADER_MESSAGE_COUNT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5',
	'font-medium tracking-normal tabular-nums text-(--desktop-text-secondary)',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
	'border border-(--desktop-border-subtle)/50'
);

export const ASSISTANT_HEADER_TAGLINE_STREAMING_CLASS = cn(
	'border-l-[rgb(var(--desktop-accent-rgb)/0.65)]',
	'text-(--desktop-text-primary)'
);

export const ASSISTANT_CLEAR_MODAL_CONFIRM_PULSE_CLASS = cn(
	'motion-safe:animate-pulse motion-reduce:animate-none',
	'ring-2 ring-rose-400/35 ring-offset-1 ring-offset-(--desktop-surface-panel)'
);

export const ASSISTANT_MOBILE_HEADER_TOOLBAR_OPEN_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_7%,var(--desktop-surface-soft))]'
);

export const ASSISTANT_MOBILE_MENU_SURFACE_CLASS = cn(
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

export const ASSISTANT_MOBILE_MENU_ITEM_FLASH_CLASS = cn(
	'bg-emerald-500/10 text-emerald-200/95'
);

export const ASSISTANT_MOBILE_MENU_CLEAR_LOCAL_FLASH_CLASS = cn(
	'bg-amber-500/10 text-amber-100/95'
);

export const ASSISTANT_MOBILE_MENU_EXPORT_READY_CLASS = cn(
	'group/menu-export',
	'[&_svg]:motion-safe:group-hover/menu-export:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none',
	'motion-safe:transition-[background-color] motion-safe:duration-150 motion-reduce:transition-none'
);

export const ASSISTANT_MOBILE_MENU_CLEAR_READY_CLASS = cn(
	'group/menu-clear',
	'motion-safe:hover:ring-1 motion-safe:hover:ring-rose-400/35',
	'[&_svg]:motion-safe:group-hover/menu-clear:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none',
	'motion-safe:transition-[background-color,box-shadow] motion-safe:duration-150 motion-reduce:transition-none'
);

export { ASSISTANT_STREAMING_BAR_INNER_CLASS };
