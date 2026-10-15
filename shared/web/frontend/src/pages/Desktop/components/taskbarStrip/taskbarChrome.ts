/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quiet chrome tokens for the Desktop taskbar rail (virtual-desktop name chip,
 * volume percent, clock date) — sentence-case meta, no shouty pills.
 *
 * Invariants:
 * - No `uppercase` / `rounded-full` on name chip or volume percent.
 * - Volume popover percent uses TASKBAR_VOLUME_PERCENT_CLASS; rail chip is icon-only.
 *
 * Related:
 * - TaskbarVolumeControl.tsx, TaskbarClock.tsx, VirtualDesktops.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';

/** Active virtual-desktop name + `1/N` beside the VD strip. */
export const TASKBAR_VD_NAME_CHIP_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'ml-0.5 flex max-w-[min(11rem,42vw)] min-w-0 items-center gap-1 rounded-md border border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/90 px-1.5 py-px font-medium tabular-nums tracking-normal text-[rgb(var(--desktop-fg-secondary-rgb)/0.88)]'
);

/** Compact VD overflow menu section title. */
export const TASKBAR_VD_COMPACT_MENU_TITLE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'px-3 py-2 font-medium tracking-normal text-(--desktop-text-muted)'
);

/** Visible percent digit beside the taskbar volume range. */
export const TASKBAR_VOLUME_PERCENT_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'w-9 shrink-0 text-right tabular-nums tracking-normal text-(--desktop-text-secondary)'
);

/** Date line under the taskbar clock. */
export const TASKBAR_CLOCK_DATE_CLASS = cn(
	DESKTOP_TYPOGRAPHY.taskbarTrayMeta,
	'tabular-nums'
);
