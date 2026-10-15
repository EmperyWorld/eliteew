/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tailwind class tokens for Assistant chat thread, message bubbles, and composer.
 *
 * Invariants:
 * - Visual tokens stay aligned with desktop shell accent/surface contract.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx
 * - pages/Desktop/components/assistant/AssistantComposerCluster.tsx
 * - pages/Desktop/components/assistant/AssistantChatMessageBubble.tsx
 */
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';

const ASSISTANT_CHAT_SCROLL_FADE_TOP =
	'pointer-events-none absolute inset-x-0 top-0 z-[2] h-7 bg-gradient-to-b from-(--desktop-surface-app) to-transparent';

const ASSISTANT_CHAT_SCROLL_FADE_BOTTOM =
	'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-9 bg-gradient-to-t from-(--desktop-surface-app) to-transparent';

export const ASSISTANT_CHAT_SCROLL_FADE_TOP_CLASS = cn(
	ASSISTANT_CHAT_SCROLL_FADE_TOP,
	'before:pointer-events-none before:absolute before:inset-x-4 before:bottom-0 before:h-px',
	'before:bg-[linear-gradient(90deg,transparent,rgb(var(--desktop-accent-rgb)/0.24),transparent)]'
);

export const ASSISTANT_CHAT_SCROLL_FADE_BOTTOM_CLASS = cn(
	ASSISTANT_CHAT_SCROLL_FADE_BOTTOM,
	'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px',
	'before:bg-[linear-gradient(90deg,transparent,rgb(var(--desktop-accent-rgb)/0.24),transparent)]'
);

export const ASSISTANT_COMPOSER_FIELD_CLASS = cn(
	'flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft)/55 px-2 py-1.5',
	'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
	'focus-within:border-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]'
);

export const ASSISTANT_BUBBLE_HOVER_CLASS =
	'motion-safe:hover:shadow-[0_10px_28px_rgba(0,0,0,0.18)] motion-safe:hover:ring-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)]';

export const ASSISTANT_STREAMING_BAR_CLASS = cn(
	'h-0.5 shrink-0 overflow-hidden',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)]'
);

export const ASSISTANT_STREAMING_BAR_INNER_CLASS = cn(
	'h-full w-full',
	'bg-[linear-gradient(90deg,color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,transparent)_0%,',
	'rgb(var(--desktop-accent-rgb)/0.92)_50%,color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,transparent)_100%)]',
	'bg-[length:220%_100%] motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:opacity-80'
);

export const ASSISTANT_CHAT_SUBHEADER_CLASS = cn(
	'shrink-0 flex items-center justify-between gap-1.5 px-3 py-2',
	'border-b border-(--desktop-border-subtle)/55',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_72%,transparent)]',
	'backdrop-blur-[4px] supports-backdrop-filter:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_62%,transparent)]',
	'transition-[border-color,background-color] duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_CHAT_SUBHEADER_STREAMING_CLASS = cn(
	'border-l-[rgb(var(--desktop-accent-rgb)/0.88)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_HISTORY_DETAILS_SUMMARY_OPEN_CLASS = cn(
	'group-open/history:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-panel))]',
	'group-open/history:text-[rgb(var(--desktop-accent-rgb)/0.92)]'
);

export const ASSISTANT_HISTORY_DETAILS_SUMMARY_READY_CLASS = cn(
	'motion-safe:transition-[background-color,color] motion-safe:duration-200 motion-reduce:transition-none',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_5%,var(--desktop-surface-panel))]',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-200',
	'[&_svg]:motion-reduce:transition-none',
	'group-hover/history:[&_svg]:translate-y-0.5'
);

export const ASSISTANT_EMPTY_CHAT_FRAME_CLASS = cn(
	'group/empty-chat space-y-3 py-1.5 rounded-lg border border-(--desktop-border-subtle)/50',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_28%,transparent)] p-3'
);

export const ASSISTANT_HISTORY_DETAILS_CLASS = cn(
	'group rounded-lg border border-(--desktop-border-subtle)',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.32)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_35%,transparent)]',
	'open:pb-3 overflow-hidden',
	'transition-[border-color,box-shadow,background-color] duration-200 motion-reduce:transition-none',
	'open:border-(--desktop-border-strong)/40 open:border-l-[rgb(var(--desktop-accent-rgb)/0.58)]',
	'open:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'open:shadow-md',
	'hover:border-(--desktop-border-strong)/35 hover:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_42%,transparent)]',
	'open:hover:border-(--desktop-border-strong)/45'
);

export const ASSISTANT_SCROLL_TO_BOTTOM_BUTTON_CLASS = cn(
	'pointer-events-auto gap-1.5 rounded-full px-3 shadow-lg backdrop-blur-sm',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.24)]',
	'motion-safe:transition-[transform,box-shadow] motion-safe:duration-200',
	'motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-xl motion-reduce:transition-none'
);

export const ASSISTANT_SCROLL_TO_BOTTOM_READY_CLASS = cn(
	'group/scroll-bottom',
	'[&_svg]:motion-safe:group-hover/scroll-bottom:translate-y-0.5',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-200',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_MESSAGE_COMPACT_TOP_CLASS = '-mt-1';

export const ASSISTANT_STREAMING_BUBBLE_SHIMMER_CLASS = cn(
	'bg-[linear-gradient(110deg,color-mix(in_srgb,var(--desktop-surface-panel)_92%,transparent)_0%,',
	'color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-panel))_45%,',
	'color-mix(in_srgb,var(--desktop-surface-panel)_92%,transparent)_90%)]',
	'bg-[length:200%_100%] motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_STOP_BUTTON_ACTIVE_CLASS = cn(
	'border-rose-500/35 bg-rose-500/10 text-rose-100/95',
	'hover:bg-rose-500/18 hover:text-rose-50',
	'ring-2 ring-rose-500/25 ring-offset-1 ring-offset-transparent',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_STOP_BUTTON_READY_CLASS = cn(
	'group/stop-btn',
	'[&_svg]:motion-safe:group-hover/stop-btn:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_ASK_AGAIN_BUTTON_CLASS = cn(
	'gap-1.5 max-sm:px-2',
	DESKTOP_TYPOGRAPHY.body,
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.95)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]'
);

export const ASSISTANT_FEEDBACK_NEGATIVE_BUTTON_CLASS = cn(
	'group/feedback-negative gap-1.5 max-sm:px-2',
	DESKTOP_TYPOGRAPHY.body,
	'hover:text-rose-200/95 hover:bg-rose-500/10 hover:ring-1 hover:ring-rose-400/30',
	'motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_FEEDBACK_NEGATIVE_ICON_CLASS = cn(
	'opacity-80',
	'motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-reduce:transition-none',
	'group-hover/feedback-negative:translate-x-0.5 group-hover/feedback-negative:opacity-100'
);

export const ASSISTANT_OPEN_FEEDBACK_BUTTON_CLASS = cn(
	'gap-1.5 border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-soft))]',
	'motion-safe:transition-[border-color,background-color,transform] motion-safe:duration-200',
	'motion-safe:hover:translate-x-0.5 motion-reduce:transition-none'
);

export const ASSISTANT_OPEN_FEEDBACK_READY_CLASS = cn(
	'group/open-feedback',
	'[&_svg]:motion-safe:group-hover/open-feedback:scale-110',
	'[&_svg]:motion-safe:group-hover/open-feedback:translate-x-0.5',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_EMPTY_FEEDBACK_FOOTER_CLASS = cn(
	'flex flex-col items-start gap-1.5 border-t border-(--desktop-border-subtle)/40 pt-2.5 mt-0.5'
);

export const ASSISTANT_EMPTY_FEEDBACK_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.caption,
	'text-(--desktop-text-dim)'
);

export const ASSISTANT_OPEN_FEEDBACK_SECONDARY_CLASS = cn(
	'gap-1 border-l-0 border-(--desktop-border-subtle)/45 text-(--desktop-text-secondary)',
	'hover:border-(--desktop-border-subtle)/65 hover:bg-(--desktop-surface-soft-hover)',
	'hover:text-(--desktop-text-primary)',
	'motion-safe:transition-[border-color,background-color,color] motion-safe:duration-200',
	'motion-reduce:transition-none'
);

export const ASSISTANT_COPY_MESSAGE_READY_CLASS = cn(
	'group/msg-copy motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/msg-copy:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_HELPFUL_READY_CLASS = cn(
	'group/helpful motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/helpful:scale-110',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_SUGGESTED_FAQ_CAPTION_CLASS = cn(
	DESKTOP_TYPOGRAPHY.small,
	'inline-flex items-center gap-1.5 rounded-md border border-(--desktop-border-subtle)/50',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.55)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'px-2 py-1.5 text-(--desktop-text-secondary)'
);

export const ASSISTANT_HELPFUL_ACK_BUTTON_CLASS = cn(
	'gap-1.5 max-sm:px-2',
	DESKTOP_TYPOGRAPHY.body,
	'text-emerald-200/95 bg-emerald-500/10',
	'ring-2 ring-emerald-400/30',
	'cursor-default'
);

export const ASSISTANT_HELPFUL_ACK_BUBBLE_CLASS = cn(
	'ring-2 ring-emerald-400/30',
	'shadow-[0_0_0_1px_color-mix(in_srgb,rgb(52_211_153)_16%,transparent)]'
);

export const ASSISTANT_MESSAGE_ACTIONS_CLASS = cn(
	'-mx-1 mt-2.5 rounded-lg border border-(--desktop-border-subtle)/45',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_28%,transparent)]',
	'px-1 pt-1.5 pb-0.5',
	'motion-safe:transition-[border-color,background-color] motion-safe:duration-200 motion-reduce:transition-none',
	'group-hover/bubble:border-[rgb(var(--desktop-accent-rgb)/0.22)]'
);

export const ASSISTANT_MESSAGE_ACTIONS_HELPFUL_CLASS = cn(
	'border-emerald-400/25',
	'bg-[color-mix(in_srgb,rgb(52_211_153)_8%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_COPY_MESSAGE_BUTTON_CLASS = cn(
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.9)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]'
);

export const ASSISTANT_HISTORY_SKELETON_BUBBLE_CLASS = cn(
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.32)]',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.08)]',
	'relative overflow-hidden',
	'before:pointer-events-none before:absolute before:inset-0',
	'before:bg-[linear-gradient(105deg,transparent_35%,rgb(var(--desktop-accent-rgb)/0.07)_50%,transparent_65%)]',
	'before:motion-safe:animate-pulse before:motion-reduce:animate-none'
);

export const ASSISTANT_SHORTCUTS_PANEL_CLASS = cn(
	'group/shortcuts mx-3 mb-1 rounded-lg border border-(--desktop-border-subtle)/40',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_18%,transparent)]',
	'open:border-l-[3px] open:border-l-[rgb(var(--desktop-accent-rgb)/0.35)]',
	'open:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_26%,transparent)]',
	'open:pb-2',
	'transition-[border-color,background-color] duration-200 motion-reduce:transition-none'
);

export const ASSISTANT_SHORTCUTS_SUMMARY_OPEN_CLASS = cn(
	'group-open/shortcuts:text-[rgb(var(--desktop-accent-rgb)/0.88)]',
	'group-open/shortcuts:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_SHORTCUTS_ROW_CLASS = cn(
	'flex items-center gap-2 rounded-md px-1 py-0.5',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,transparent)]',
	'motion-safe:transition-colors motion-safe:duration-150 motion-reduce:transition-none'
);

export const ASSISTANT_SHORTCUTS_ROW_ACTIVE_CLASS = cn(
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]',
	'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.18)]'
);

export const ASSISTANT_COMPOSER_SHORTCUTS_LINK_CLASS = cn(
	'underline decoration-[rgb(var(--desktop-accent-rgb)/0.35)] underline-offset-2',
	'hover:text-[rgb(var(--desktop-accent-rgb)/0.92)] hover:decoration-[rgb(var(--desktop-accent-rgb)/0.55)]',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.35)] rounded-sm'
);

export const ASSISTANT_COMPOSER_SHORTCUTS_LINK_READY_CLASS = cn(
	'motion-safe:transition-[color,text-decoration-color] motion-safe:duration-150 motion-reduce:transition-none',
	'hover:decoration-2'
);

export const ASSISTANT_SHORTCUTS_PANEL_FLASH_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
	'shadow-[0_0_0_1px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_18%,transparent)]'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_CLASS = cn(
	'max-w-full text-left whitespace-normal h-auto py-1.5 gap-1.5',
	'border border-(--desktop-border-subtle)/80',
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,var(--desktop-surface-soft))]',
	'motion-safe:transition-[transform,border-color,background-color] motion-safe:duration-150 motion-reduce:transition-none'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_READY_CLASS = cn(
	'motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100'
);

export const ASSISTANT_COMPOSER_READY_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.42)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-soft))]'
);

export const ASSISTANT_PENDING_USER_BUBBLE_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.22)]',
	'border-t-[3px] border-t-[rgb(var(--desktop-accent-rgb)/0.55)]',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_HINT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.caption,
	'inline-flex items-start gap-1.5 rounded-md border border-(--desktop-border-subtle)/50',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'px-2 py-1.5 text-(--desktop-text-secondary)'
);

export const ASSISTANT_COMPOSER_CHAR_COUNTER_CLASS = cn(
	'inline-flex rounded-full border px-2 py-0.5 tabular-nums'
);

export const ASSISTANT_COMPOSER_CHAR_WARN_CLASS = cn(
	'border-amber-400/35 bg-amber-500/10 font-medium text-amber-300/95'
);

export const ASSISTANT_COMPOSER_CHAR_DANGER_CLASS = cn(
	'border-rose-400/35 bg-rose-500/10 font-medium text-rose-400/90',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_CHAT_LOCAL_FAQ_COLUMN_CLASS = cn(
	'border-l-[2px] border-l-amber-400/45',
	'bg-[color-mix(in_srgb,rgb(245_158_11)_3%,var(--desktop-surface-app))]'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_FLASH_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.55)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,var(--desktop-surface-soft))]',
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.18)]'
);

export const ASSISTANT_ASK_AGAIN_READY_CLASS = cn(
	'group/ask-again ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100',
	'[&_svg]:motion-safe:group-hover/ask-again:rotate-180',
	'[&_svg]:motion-safe:transition-transform [&_svg]:motion-safe:duration-300',
	'[&_svg]:motion-reduce:transition-none'
);

export const ASSISTANT_ASK_AGAIN_FLASH_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)]',
	'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
);

export const ASSISTANT_ASK_AGAIN_BUBBLE_FLASH_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'shadow-[0_0_0_1px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]'
);

export const ASSISTANT_EMPTY_SUGGESTIONS_WRAP_CLASS = cn(
	'rounded-lg border border-dashed border-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_4%,var(--desktop-surface-panel))]',
	'p-2 space-y-1.5'
);

export const ASSISTANT_EMPTY_ICON_PULSE_CLASS = cn(
	'relative inline-flex',
	'after:absolute after:-right-0.5 after:-top-0.5 after:h-2.5 after:w-2.5 after:rounded-full',
	'after:bg-[rgb(var(--desktop-accent-rgb)/0.85)] after:ring-2 after:ring-(--desktop-surface-panel)',
	'after:motion-safe:animate-pulse after:motion-reduce:after:animate-none after:content-[""]',
	'motion-safe:transition-transform motion-safe:duration-200 motion-reduce:transition-none',
	'group-hover/empty-chat:scale-105'
);

export const ASSISTANT_COMPOSER_FOCUSED_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.48)]',
	'shadow-[0_0_0_3px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_16%,transparent)]'
);

export const ASSISTANT_SHORTCUTS_KBD_OPEN_CLASS = cn(
	'group-open/shortcuts:border-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'group-open/shortcuts:text-[rgb(var(--desktop-accent-rgb)/0.88)]',
	'group-open/shortcuts:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-panel))]'
);

export const ASSISTANT_SEND_READY_HOVER_CLASS =
	'motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100';

export const ASSISTANT_SEND_RATE_LIMIT_CLASS = cn(
	'ring-2 ring-amber-400/35 ring-offset-1 ring-offset-transparent',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_MESSAGE_TIME_CLASS = cn(
	DESKTOP_TYPOGRAPHY.caption,
	'inline-flex items-center gap-1 rounded-full border border-(--desktop-border-subtle)/60',
	'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_40%,transparent)]',
	'px-2 py-0.5 tabular-nums text-(--desktop-text-dim)',
	'motion-safe:transition-[border-color,color,background-color] motion-safe:duration-150 motion-reduce:transition-none',
	'group-hover/bubble:border-[rgb(var(--desktop-accent-rgb)/0.35)]',
	'group-hover/bubble:text-[rgb(var(--desktop-accent-rgb)/0.85)]',
	'group-hover/bubble:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_INSERT_FLASH_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.55)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,var(--desktop-surface-soft))]',
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.22)]'
);

export const ASSISTANT_SUGGESTED_FAQ_CHIP_ASK_FLASH_CLASS = cn(
	'border-[rgb(var(--desktop-accent-rgb)/0.62)]',
	'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_16%,var(--desktop-surface-soft))]',
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.28)]'
);

export const ASSISTANT_SCROLL_STREAMING_ACTIVE_CLASS = cn(
	'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);

export const ASSISTANT_RATE_LIMIT_BANNER_CLASS = cn(
	'mx-4 mb-2 flex gap-2.5 rounded-lg border border-amber-500/35',
	'border-l-[3px] border-l-amber-400/70',
	'bg-[color-mix(in_srgb,rgb(245_158_11)_12%,transparent)]',
	'px-3 py-2',
	DESKTOP_TYPOGRAPHY.small,
	'tabular-nums text-amber-200/95',
	'shadow-[inset_0_1px_0_0_color-mix(in_srgb,rgb(251_191_36)_25%,transparent)]'
);

export const ASSISTANT_RATE_LIMIT_BANNER_FAQ_LINK_CLASS = cn(
	'motion-safe:transition-[color,text-decoration-color] motion-safe:duration-150 motion-reduce:transition-none',
	'hover:decoration-amber-100/90 hover:decoration-2',
	'hover:text-amber-50/95'
);

export const ASSISTANT_COMPOSER_RATE_LIMIT_WRAP_CLASS = cn(
	'relative overflow-hidden',
	'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-[1] before:h-0.5',
	'before:bg-[linear-gradient(90deg,transparent,rgb(251_191_36/0.85),transparent)]',
	'before:motion-safe:animate-pulse motion-reduce:before:animate-none'
);

export const ASSISTANT_COMPOSER_RATE_LIMIT_HINT_CLASS = cn(
	'inline-flex items-center gap-1 rounded-full border border-amber-400/30',
	'bg-amber-500/10 px-2 py-0.5 tabular-nums text-amber-200/90'
);

export const ASSISTANT_STREAM_STOPPED_HINT_CLASS = cn(
	'inline-flex items-center gap-1 rounded-full border border-rose-400/30',
	'bg-rose-500/10 px-2 py-0.5 text-rose-200/90',
	'ring-1 ring-rose-400/20',
	'motion-safe:animate-pulse motion-reduce:animate-none'
);
