/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tailwind class tokens for the Assistant FAQ sidebar panel.
 *
 * Invariants:
 * - Visual tokens stay aligned with desktop shell accent/surface contract.
 * - `ASSISTANT_FAQ_ANSWER_LABEL_CLASS` stays sentence-case (no uppercase shout).
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantFaqPanel.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md §Справочник
 */
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '../DesktopAppChrome';

export const ASSISTANT_KBD_HINT_CLASS = cn(
	'inline-flex items-center rounded border border-(--desktop-border-subtle)/80',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_75%,transparent)]',
	'px-1.5 py-0.5 font-medium leading-none text-(--desktop-text-dim) shadow-sm'
);

export const ASSISTANT_FAQ_CARD_CLASS = cn(
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'hover:border-l-[rgb(var(--desktop-accent-rgb)/0.72)]'
);

export const ASSISTANT_FAQ_CARD_HOVER_READY_CLASS = cn(
	'motion-safe:hover:scale-[1.005] motion-reduce:hover:scale-100',
	'motion-safe:transition-transform motion-safe:duration-150 motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_COLLAPSED_HINT_CLASS = cn(
	'md:hidden w-full rounded-lg border border-dashed border-(--desktop-border-subtle)/80',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
	'px-3 py-2 text-left',
	DESKTOP_TYPOGRAPHY.caption,
	'text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.32)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-soft))]',
	'motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200',
	'hover:shadow-sm',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const ASSISTANT_FAQ_SEARCH_WRAP_CLASS = cn(
	'relative rounded-lg transition-[box-shadow] duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SKELETON_CLASS = cn(
	'h-[4.5rem] rounded-(--desktop-radius) border border-(--desktop-border-subtle)/50',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.32)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,transparent)]',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.08)]',
	'relative overflow-hidden',
	'before:pointer-events-none before:absolute before:inset-0',
	'before:bg-[linear-gradient(105deg,transparent_35%,rgb(var(--desktop-accent-rgb)/0.07)_50%,transparent_65%)]',
	'before:motion-safe:animate-pulse before:motion-reduce:animate-none'
);

export const ASSISTANT_ERROR_STATE_ICON_WRAP_CLASS = cn(
	DESKTOP_APP_STYLE_CONTRACT.emptyIcon,
	'h-11! w-11! border-rose-500/25 bg-rose-500/10'
);

export const ASSISTANT_FAQ_REFRESH_READY_CLASS = cn(
	'group/faq-refresh',
	'[&_svg]:motion-safe:group-hover/faq-refresh:rotate-180',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-300',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_REFRESH_SUCCESS_CLASS = cn(
	'text-emerald-200/95 bg-emerald-500/10',
	'hover:text-emerald-200/95 hover:bg-emerald-500/10'
);

export const ASSISTANT_FAQ_ASK_READY_CLASS = cn(
	'group/faq-ask motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/faq-ask:translate-x-0.5',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SEARCH_CLEAR_READY_CLASS = cn(
	'group/faq-clear',
	'[&_svg]:motion-safe:group-hover/faq-clear:rotate-90',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-200',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SHOW_IN_CHAT_BUTTON_CLASS = cn(
	'gap-1.5 max-sm:px-2',
	DESKTOP_TYPOGRAPHY.body,
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
);

export const ASSISTANT_FAQ_SHOW_READY_CLASS = cn(
	'group/faq-show motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/faq-show:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_EMPTY_FRAME_CLASS = cn(
	'mx-1 flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--desktop-border-subtle)/60',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'px-4 py-6 text-center'
);

export const ASSISTANT_FAQ_CARD_ACTIONS_CLASS = cn(
	'flex flex-col gap-1.5 border-t border-(--desktop-border-subtle)/80 pt-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between',
	'transition-[border-color,background-color] duration-200 motion-reduce:transition-none',
	'group-has-[details[open]]/faq-card:border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'group-has-[details[open]]/faq-card:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_3%,transparent)]',
	'group-has-[details[open]]/faq-card:px-1 group-has-[details[open]]/faq-card:-mx-1 group-has-[details[open]]/faq-card:rounded-b-lg'
);

export const ASSISTANT_FAQ_ANSWER_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'mb-1.5 inline-flex items-center gap-1 border-l-2 border-[rgb(var(--desktop-accent-rgb)/0.45)] pl-2',
	'font-medium tracking-normal text-(--desktop-text-dim)'
);

export const ASSISTANT_FAQ_COUNT_BADGE_FLASH_CLASS = cn(
	'ring-2 ring-emerald-400/30',
	'border-emerald-400/35',
	'bg-[color-mix(in_srgb,rgb(52_211_153)_12%,transparent)]',
	'text-emerald-200/95'
);

export const ASSISTANT_FAQ_INSERT_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex items-start gap-1.5 rounded-md border border-(--desktop-border-subtle)/50',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'px-2 py-1.5 font-medium tracking-normal text-(--desktop-text-secondary)'
);

export const ASSISTANT_FAQ_MOBILE_TOGGLE_CHEVRON_CLASS = cn(
	'h-4 w-4 shrink-0',
	'motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_COPY_BUTTON_CLASS = cn(
	'gap-1 max-sm:px-2',
	DESKTOP_TYPOGRAPHY.body,
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.9)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]'
);

export const ASSISTANT_FAQ_COPY_READY_CLASS = cn(
	'group/faq-copy motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/faq-copy:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_INSERT_READY_CLASS = cn(
	'group/faq-insert motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/faq-insert:-translate-y-0.5',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_COPY_FLASH_SUCCESS_CLASS = cn(
	'text-emerald-200/95 bg-emerald-500/10',
	'hover:text-emerald-200/95 hover:bg-emerald-500/10'
);

export const ASSISTANT_FAQ_COUNT_BADGE_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.88)] font-medium'
);

export const ASSISTANT_FAQ_INSERT_BUTTON_CLASS = cn(
	'gap-1.5',
	DESKTOP_TYPOGRAPHY.body,
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
);

export const ASSISTANT_FAQ_INSERT_FLASH_CLASS = cn(
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)]',
	'cursor-default'
);

export const ASSISTANT_FAQ_QUESTION_INSERT_READY_CLASS = cn(
	'motion-safe:transition-[text-decoration-color,background-color] motion-safe:duration-150 motion-reduce:transition-none',
	'hover:decoration-2 hover:underline-offset-2'
);

export const ASSISTANT_FAQ_QUESTION_INSERT_FLASH_CLASS = cn(
	'underline decoration-2 underline-offset-2',
	'decoration-[rgb(var(--desktop-accent-rgb)/0.75)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]',
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.18)]'
);

export const ASSISTANT_FAQ_SHOW_IN_CHAT_FLASH_CLASS = cn(
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
	'cursor-default'
);

export const ASSISTANT_FAQ_ASIDE_SEARCH_ACTIVE_CLASS = cn(
	'md:border-r-[2px] md:border-r-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_FAQ_SEARCH_ACTION_CLASS = cn(
	'h-auto gap-1 px-2 py-0.5',
	DESKTOP_TYPOGRAPHY.meta,
	'text-(--desktop-text-secondary)',
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.9)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]',
	'motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-150 motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SEARCH_ACTION_READY_CLASS = cn(
	'group/faq-bulk',
	'[&_svg]:motion-safe:group-hover/faq-bulk:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SEARCH_ACTION_FLASH_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.22)]'
);

export const ASSISTANT_FAQ_SEARCH_COUNT_BADGE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.caption,
	'-mt-1 mb-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 tabular-nums',
	'border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]',
	'font-medium text-[rgb(var(--desktop-accent-rgb)/0.9)]'
);

export const ASSISTANT_FAQ_SEARCH_COUNT_EMPTY_CLASS = cn(
	'border-(--desktop-border-subtle)/60',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
	'font-normal text-(--desktop-text-dim)'
);

export const ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_CLASS = cn(
	'absolute right-2 top-1/2 -translate-y-1/2 rounded p-1',
	'text-(--desktop-text-dim) hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-soft-hover))]',
	DESKTOP_CHROME_FOCUS_VISIBLE
);

export const ASSISTANT_FAQ_SEARCH_FIELD_CLEAR_READY_CLASS = cn(
	'group/faq-field-clear',
	'[&_svg]:motion-safe:group-hover/faq-field-clear:rotate-90',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-200',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_SEARCH_KBD_ACTIVE_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.92)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_FAQ_MOBILE_TOGGLE_OPEN_CLASS = cn(
	'shrink-0 gap-1 px-2 md:hidden',
	'text-[rgb(var(--desktop-accent-rgb)/0.9)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_MOBILE_TOGGLE_CLOSED_CLASS = cn(
	'shrink-0 gap-1 px-2 md:hidden',
	'text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
	'hover:ring-1 hover:ring-[rgb(var(--desktop-accent-rgb)/0.22)]',
	'motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-200'
);

export const ASSISTANT_FAQ_CARD_COPY_FLASH_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'shadow-[0_0_0_1px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,transparent)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_5%,var(--desktop-surface-soft))]'
);

export const ASSISTANT_ERROR_RETRY_BUTTON_CLASS = cn(
	'gap-1.5',
	'text-rose-300/90 hover:text-rose-100 hover:bg-rose-500/10'
);

export const ASSISTANT_ERROR_RETRY_READY_CLASS = cn(
	'group/error-retry',
	'[&_svg]:motion-safe:group-hover/error-retry:rotate-180',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-300',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_FAQ_CARD_OPEN_SUMMARY_CLASS = cn(
	'group-open:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-soft-hover))]',
	'group-open:text-[rgb(var(--desktop-accent-rgb)/0.92)]'
);

export const ASSISTANT_ERROR_STATE_FRAME_CLASS = cn(
	'rounded-xl border border-rose-500/25 border-l-[3px] border-l-rose-400/65',
	'bg-[color-mix(in_srgb,rgb(244_63_94)_6%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_FAQ_ASK_FLASH_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'shadow-[0_0_0_1px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]'
);

export const ASSISTANT_FAQ_SEARCH_FOCUS_FLASH_CLASS = cn(
	'shadow-[0_0_0_3px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]',
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.28)]'
);

export const ASSISTANT_FAQ_HEADER_REFRESHING_CLASS = cn(
	'border-b-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_FAQ_REFRESH_FETCHING_CLASS = cn(
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]'
);

export const ASSISTANT_FAQ_SEARCH_EMPTY_FRAME_CLASS = cn(
	'mb-3 flex flex-col items-center gap-2 rounded-lg border border-dashed py-4 text-center',
	'border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_FAQ_SEARCH_CLEAR_BUTTON_CLASS = cn(
	'gap-1.5 px-2 text-(--desktop-text-secondary)',
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
);

export const ASSISTANT_FAQ_SEARCH_MAGNIFY_FLASH_CLASS = cn(
	'motion-safe:animate-pulse motion-reduce:animate-none',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
);
