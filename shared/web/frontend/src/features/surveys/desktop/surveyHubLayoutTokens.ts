/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout tokens for Survey Hub desktop surfaces (hero, cards, KPI strip).
 *
 * Related:
 * - SurveyHubDesktopApp.tsx
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

export const SH_HERO_PANEL_CLASS =
	'rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-(--desktop-surface-accent) p-5 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.04)]';

export const SH_KPI_GRID_CLASS = 'mt-4 grid gap-3 sm:grid-cols-3';

export const SH_KPI_TILE_CLASS =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2.5';

export const SH_SURVEY_CARD_CLASS =
	'flex h-full flex-col gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-4 transition-colors hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]';

export const SH_SURVEY_CARD_COMPLETED_CLASS =
	'opacity-95 hover:border-(--desktop-border-subtle)';

export const SH_SECTION_STACK_CLASS = 'space-y-3';

/** Runner hero: progress, reward, trust context above question card. */
export const SH_RUNNER_HERO_CLASS =
	'rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.18)] bg-(--desktop-surface-accent) px-4 py-3.5 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.04)]';

export const SH_RUNNER_PROGRESS_TRACK_CLASS =
	'h-2 overflow-hidden rounded-full bg-(--desktop-surface-soft)';

export const SH_RUNNER_PROGRESS_FILL_CLASS =
	'h-full rounded-full bg-(--desktop-accent) transition-[width] duration-300 motion-reduce:transition-none';

export const SH_RUNNER_CHOICE_BASE_CLASS =
	'rounded-(--desktop-radius-lg) border px-4 py-4 text-left text-sm leading-snug transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none';

export const SH_RUNNER_CHOICE_SELECTED_CLASS =
	'border-[rgb(var(--desktop-accent-rgb)/0.55)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.2)]';

export const SH_RUNNER_CHOICE_IDLE_CLASS =
	'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-(--desktop-surface-panel)';

export const SH_RUNNER_TEXTAREA_CLASS =
	'min-h-[132px] w-full resize-y rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors duration-200 motion-reduce:transition-none scheme-dark focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)';

export const SH_RUNNER_SCALE_VALUE_CLASS =
	'inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-3 py-1 text-base font-semibold tabular-nums text-(--desktop-text-primary)';

export const SH_RUNNER_REVIEW_CARD_CLASS =
	'w-full rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3 text-left transition-colors hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:bg-(--desktop-surface-panel)';

export const SH_RUNNER_ACTION_BAR_CLASS =
	'sticky bottom-0 z-10 -mx-1 mt-auto flex flex-wrap items-center gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/95 px-1 py-3 backdrop-blur-sm';

export const SH_RUNNER_SUCCESS_PANEL_CLASS =
	'mx-4 mb-4 flex flex-col gap-4 rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-(--desktop-surface-accent) p-6 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]';

export const SH_RUNNER_QUESTION_PANEL_CLASS =
	'flex min-h-0 flex-1 flex-col overflow-y-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-6';

export const SH_RUNNER_STEP_BADGE_CLASS =
	'inline-flex items-center rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.25)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--desktop-accent-rgb))]';

export const SH_RUNNER_SCALE_CHIP_CLASS =
	'inline-flex h-10 min-w-10 items-center justify-center rounded-(--desktop-radius) border px-2 text-sm font-medium tabular-nums transition-[border-color,background-color,transform] duration-150 motion-reduce:transition-none';

export const SH_RUNNER_SCALE_CHIP_SELECTED_CLASS =
	'border-[rgb(var(--desktop-accent-rgb)/0.55)] bg-[rgb(var(--desktop-accent-rgb)/0.16)] text-(--desktop-text-primary) scale-105 motion-reduce:scale-100';

export const SH_RUNNER_SCALE_CHIP_IDLE_CLASS =
	'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:border-[rgb(var(--desktop-accent-rgb)/0.3)] hover:bg-(--desktop-surface-panel)';

export const SH_RUNNER_REWARD_CHIP_CLASS =
	'inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-3 py-1 text-sm text-(--desktop-text-primary)';

export const SH_RUNNER_STEP_PILL_CLASS =
	'inline-flex h-7 min-w-7 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none';

export const SH_RUNNER_STEP_PILL_DONE_CLASS =
	'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb))] text-(--desktop-surface-panel)';

export const SH_RUNNER_STEP_PILL_ACTIVE_CLASS =
	'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.18)] text-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_0_2px_rgb(var(--desktop-accent-rgb)/0.2)]';

export const SH_RUNNER_STEP_PILL_IDLE_CLASS =
	'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)';

export const SH_RUNNER_EXIT_CONFIRM_MODAL_CLASS = 'max-w-md';

export const SH_RUNNER_EXIT_CONFIRM_ACTIONS_CLASS =
	'mt-5 flex flex-wrap justify-end gap-2';

export const SH_SURVEY_CARD_URGENT_CLASS =
	'border-amber-500/35 hover:border-amber-500/50';
