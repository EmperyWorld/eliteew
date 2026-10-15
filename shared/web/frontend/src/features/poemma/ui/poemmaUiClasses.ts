/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind class tokens for POEMMA visual rhythm (spacing, surfaces, forms, semantics).
 *
 * Invariants:
 * - Tokens compose with Desktop chrome CSS variables; no hardcoded product palette outside accent rgb.
 * - Russian UI copy lives in page modules, not here.
 *
 * Related:
 * - src/features/poemma/ui/index.ts
 */

import { cn } from '@/utils/cn';

/** Shared inset highlight for POEMMA elevated surfaces. */
const POEMMA_INSET_HIGHLIGHT =
	'shadow-[inset_0_1px_0_color-mix(in_srgb,#fff_8%,transparent)]';

/** Subtle inner ring for panel depth on light/dark shells. */
const POEMMA_SURFACE_RING =
	'ring-1 ring-inset ring-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.07)_100%,transparent)]';

export const POEMMA_PAGE_SHELL_CLASS =
	'grid gap-4 p-4 md:gap-6 md:p-5 lg:gap-7 lg:p-6';

export const POEMMA_PAGE_CONTENT_CLASS = 'w-full min-w-0';

export const POEMMA_PAGE_PANEL_CLASS = cn(
	'p-5 md:p-6',
	POEMMA_SURFACE_RING,
	'shadow-[var(--desktop-shadow-soft)]',
	POEMMA_INSET_HIGHLIGHT
);

export const POEMMA_HERO_PANEL_CLASS = cn(
	'overflow-hidden rounded-(--desktop-radius-lg)',
	'border border-[rgb(var(--desktop-accent-rgb)/0.32)]',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.52)]',
	'p-5 md:p-6',
	'bg-[linear-gradient(128deg,color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_16%,var(--desktop-surface-panel))_0%,var(--desktop-surface-panel)_58%,color-mix(in_srgb,var(--desktop-surface-soft)_90%,var(--desktop-surface-panel))_100%)]',
	'shadow-[var(--desktop-shadow-soft),inset_0_1px_0_color-mix(in_srgb,#fff_10%,transparent)]',
	POEMMA_SURFACE_RING
);

/** Page title typography — hero and header blocks. */
export const POEMMA_DISPLAY_TITLE_CLASS =
	'text-2xl font-semibold tracking-tight text-(--desktop-text-primary) md:text-[1.75rem] md:leading-tight';

export const POEMMA_DISPLAY_TITLE_HERO_CLASS =
	'text-2xl font-semibold tracking-tight text-(--desktop-text-primary) md:text-3xl md:leading-tight';

export const POEMMA_META_CHIP_CLASS = cn(
	'shrink-0 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_78%,var(--desktop-surface-panel))] px-3.5 py-2.5 text-right',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

export const POEMMA_TOP_BAR_CLASS = cn(
	'grid shrink-0 gap-3 border-b border-(--desktop-border-subtle) px-3 py-3 md:px-4',
	'bg-(--desktop-surface-soft)/25 backdrop-blur-sm',
	POEMMA_INSET_HIGHLIGHT
);

/** Primary app title in top bar — matches desktop productivity apps. */
export const POEMMA_APP_TITLE_CLASS =
	'text-base font-semibold tracking-tight text-(--desktop-text-primary) md:text-lg';

/** Session subtitle under app title. */
export const POEMMA_APP_SUBTITLE_CLASS =
	'truncate text-sm text-(--desktop-text-secondary)';

export const POEMMA_NAV_TRACK_CLASS = cn(
	'flex min-w-0 flex-wrap items-center gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) p-1',
	'bg-(--desktop-surface-panel)/80',
	POEMMA_SURFACE_RING
);

/** Vertical accent bar beside section titles. */
export const POEMMA_SECTION_TITLE_MARKER_CLASS = cn(
	'mt-0.5 w-1 shrink-0 self-stretch min-h-[1.35rem] rounded-full',
	'bg-[linear-gradient(180deg,rgb(var(--desktop-accent-rgb)/0.72)_0%,rgb(var(--desktop-accent-rgb)/0.28)_100%)]',
	'shadow-[0_0_14px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]'
);

/** Primary in-page section heading (readable, not all-caps). */
export const POEMMA_SECTION_TITLE_CLASS =
	'min-w-0 text-lg font-semibold leading-snug tracking-tight text-(--desktop-text-primary) md:text-xl';

/** Compact section title for map tiles and dense stacks. */
export const POEMMA_SECTION_TITLE_COMPACT_CLASS =
	'min-w-0 text-base font-semibold leading-snug tracking-tight text-(--desktop-text-primary)';

/** Optional helper line under a section title. */
export const POEMMA_SECTION_HELPER_CLASS = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.28)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,var(--desktop-surface-panel))] px-4 py-3',
	'text-sm leading-6 text-(--desktop-text-secondary) md:text-[0.9375rem] md:leading-7',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

/** Soft content well for grouped section fields. */
export const POEMMA_SECTION_BODY_CLASS = cn(
	'grid gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_48%,var(--desktop-surface-panel))] p-4 md:gap-4 md:p-5',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

/** Inner card for multi-column section grids (e.g. segment slots). */
export const POEMMA_SECTION_CARD_CLASS = cn(
	'grid gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[linear-gradient(165deg,color-mix(in_srgb,var(--desktop-surface-soft)_78%,var(--desktop-surface-panel))_0%,var(--desktop-surface-panel)_55%)]',
	'p-4 md:p-5',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

export const POEMMA_SECTION_ACCENT_RULE_CLASS =
	'h-px w-full bg-[linear-gradient(90deg,rgb(var(--desktop-accent-rgb)/0.5)_0%,rgb(var(--desktop-accent-rgb)/0.12)_42%,transparent_78%)]';

/** Secondary label above titles — readable, not dashboard uppercase. */
export const POEMMA_EYEBROW_LABEL_CLASS =
	'text-xs font-medium tracking-wide text-(--desktop-text-secondary)';

/** Muted meta row in toolbars. */
export const POEMMA_EYEBROW_MUTED_CLASS =
	'text-[0.6875rem] font-medium text-(--desktop-text-muted)';

/** Standard form field label (sentence case). */
export const POEMMA_FIELD_LABEL_CLASS =
	'text-sm font-semibold text-(--desktop-text-primary)';

export const POEMMA_FORM_GRID_CLASS = 'grid gap-3';

export const POEMMA_WIZARD_FOOTER_CLASS = cn(
	'flex flex-wrap items-center justify-between gap-3 border-t border-(--desktop-border-subtle)',
	'pt-4'
);

export const POEMMA_SEMANTIC_SUCCESS_CLASS =
	'text-[color-mix(in_srgb,rgb(16_185_129)_72%,var(--desktop-text-primary))]';

export const POEMMA_SEMANTIC_WARNING_CLASS =
	'text-[color-mix(in_srgb,rgb(245_158_11)_78%,var(--desktop-text-primary))]';

export const POEMMA_SEMANTIC_DANGER_CLASS =
	'text-[color-mix(in_srgb,rgb(239_68_68)_72%,var(--desktop-text-primary))]';

export const POEMMA_SEMANTIC_INFO_CLASS =
	'text-[color-mix(in_srgb,rgb(14_165_233)_72%,var(--desktop-text-primary))]';

export const POEMMA_TOP_NAV_CHIP_ACTIVE_CLASS = cn(
	'rounded-(--desktop-radius) px-3 py-1.5 text-sm font-medium text-(--desktop-text-primary)',
	'bg-[rgb(var(--desktop-accent-rgb)/0.18)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.28)]'
);

export const POEMMA_TOP_NAV_CHIP_INACTIVE_CLASS = cn(
	'shrink-0 rounded-(--desktop-radius) px-3 py-1.5 text-sm font-medium transition-[color,background-color]',
	'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset',
	'focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

/** Large tabular metric values (money, counts). */
export const POEMMA_METRIC_VALUE_CLASS =
	'text-2xl font-semibold tabular-nums tracking-tight text-(--desktop-text-primary)';

export const POEMMA_METRIC_CELL_CLASS = cn(
	'grid gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_68%,var(--desktop-surface-panel))] px-3.5 py-3.5',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

export const POEMMA_PROGRESS_TRACK_CLASS =
	'h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,var(--desktop-border-subtle))]';

export const POEMMA_PROGRESS_FILL_ACCENT_CLASS = cn(
	'h-full rounded-full bg-[rgb(var(--desktop-accent-rgb))] transition-[width]',
	'shadow-[0_0_12px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_32%,transparent)]'
);

export const POEMMA_PROGRESS_FILL_MUTED_CLASS =
	'h-full rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.82)] transition-[width]';

export const POEMMA_MAP_TILE_ARROW_CLASS =
	'text-sm font-semibold text-(--desktop-text-secondary) transition-colors group-hover:text-(--desktop-text-primary)';

export const POEMMA_CHECKLIST_DONE_CLASS = cn(
	'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
	'bg-[rgb(var(--desktop-accent-rgb))] text-[color-mix(in_srgb,#fff_92%,var(--desktop-text-primary))]'
);

export const POEMMA_CHECKLIST_PENDING_CLASS = cn(
	'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
	'border-(--desktop-border-strong) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)'
);

export const POEMMA_TEXTAREA_CLASS = cn(
	'w-full resize-y rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,var(--desktop-surface-panel))] px-3 py-3',
	'text-sm leading-relaxed text-(--desktop-text-primary)',
	POEMMA_SURFACE_RING,
	'placeholder:text-(--desktop-text-dim)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.35)] focus:outline-none',
	'focus:ring-2 focus:ring-inset focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

export const POEMMA_FIELD_ERROR_CLASS =
	'text-sm font-semibold text-[color-mix(in_srgb,rgb(185_28_28)_85%,var(--desktop-text-primary))]';

export const POEMMA_PANEL_INTERACTIVE_CLASS = cn(
	'group w-full rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-panel) p-5 text-left transition-[border-color,background-color,box-shadow,transform] md:p-6',
	POEMMA_SURFACE_RING,
	POEMMA_INSET_HIGHLIGHT,
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.24)] hover:bg-(--desktop-surface-soft)',
	'hover:shadow-[0_10px_28px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,transparent)]',
	'active:scale-[0.998] active:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_85%,var(--desktop-surface-panel))]',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset',
	'focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

export const POEMMA_LIST_ROW_SURFACE_CLASS = cn(
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_62%,var(--desktop-surface-panel))] px-3.5 py-3 transition-[border-color,background-color,box-shadow]',
	POEMMA_SURFACE_RING,
	POEMMA_INSET_HIGHLIGHT,
	'hover:border-[rgb(var(--desktop-accent-rgb)/0.2)] hover:bg-(--desktop-surface-soft)',
	'hover:shadow-[0_4px_16px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_8%,transparent)]'
);

export const POEMMA_CONTEXT_CARD_CLASS = cn(
	'grid gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.38)]',
	'bg-[color-mix(in_srgb,var(--desktop-surface-muted)_84%,var(--desktop-surface-panel))] p-4 md:p-5',
	POEMMA_INSET_HIGHLIGHT,
	POEMMA_SURFACE_RING
);

export const POEMMA_NAV_RAIL_CLASS = cn(
	'border-b border-(--desktop-border-subtle) px-4 py-3 md:px-5',
	'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)]',
	POEMMA_INSET_HIGHLIGHT
);
