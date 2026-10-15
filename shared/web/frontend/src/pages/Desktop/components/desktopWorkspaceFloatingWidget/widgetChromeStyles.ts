/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind class bundles for floating widget chrome sections
 * (clock / timezone, credits, now-playing strip).
 *
 * Invariants:
 * - Uses desktop design tokens only; no one-off palette.
 * - Eyebrow / timezone labels stay sentence-case (no `uppercase` shout).
 *
 * Related:
 * - DesktopWorkspaceFloatingWidget.tsx
 * - FloatingWidgetClockSection.tsx
 * - DesktopFloatingWidgetNowPlayingStrip.tsx
 * - documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';

export const widgetSectionClassName =
	'rounded-[1.15rem] border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) shadow-(--desktop-shadow-soft)';

/** Status chips under the clock — quiet rounded-md, not shouty pills. */
export const widgetChipClassName = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'inline-flex items-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 tracking-normal'
);

/** Credits KPI cell — hairline panel, no accent wash. */
export const widgetCreditsClassName =
	'relative flex w-full items-center justify-center overflow-hidden rounded-[1rem] border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-1.5 py-1.5 shadow-(--desktop-shadow-soft)';

/** Timezone field label under the clock. */
export const FLOATING_WIDGET_TIMEZONE_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'mb-1 block tracking-normal'
);

/** Compact now-playing card nested in the floating widget. */
export const FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS =
	'group relative mx-2.5 mb-2.5 flex flex-col gap-2.5 overflow-hidden rounded-[1.2rem] border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2.5 text-left shadow-(--desktop-shadow-soft) transition-colors';

export const FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'tracking-normal'
);

export const FLOATING_WIDGET_NOW_PLAYING_CONTROLS_CLASS =
	'relative mt-0.5 rounded-[0.95rem] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5';
