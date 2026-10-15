/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Spacing and grid class tokens for Professional Worlds desktop UI.
 *
 * Invariants:
 * - Uses desktop CSS variables only; no hard-coded theme colors here.
 *
 * Related:
 * - layout/* workspace chrome components
 */

import { cn } from '@/utils/cn';

/** Vertical rhythm between workspace sections (subtabs → panels). */
export const PW_WORKSPACE_SECTION_GAP = 'grid gap-3';

/** Standard panel interior padding and gap. */
export const PW_WORKSPACE_PANEL_CLASS = 'grid gap-3 p-4';

/** Body-only rhythm when nested inside another workspace panel (`embedded`). */
export const PW_PANEL_EMBEDDED_CLASS = 'grid gap-3';

/** AI output rail footer (sticky below workspace scroll). */
export const PW_AI_OUTPUT_PANEL_CLASS =
	'grid gap-3 border-t border-(--desktop-border-subtle) p-4';

/** Runtime shell nav column (not a workspace content panel). */
export const PW_SHELL_SIDEBAR_PANEL_CLASS = 'min-h-0 overflow-auto p-2';

/** Two-column form layout on wide surfaces. */
export const PW_FORM_GRID_CLASS = 'grid gap-3 md:grid-cols-2';

/** Overview pulse metric row. */
export const PW_METRIC_GRID_CLASS =
	'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5';

/** Above-the-fold visible redesign shell for Professional Worlds overview. */
export const PW_VISIBLE_HERO_CLASS =
	'overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-[radial-gradient(circle_at_12%_0%,rgb(var(--desktop-accent-rgb)/0.18),transparent_34%),linear-gradient(135deg,rgb(var(--desktop-bg-primary-rgb)/0.16),rgb(var(--desktop-bg-primary-rgb)/0.04))] p-4 shadow-[var(--desktop-shadow-soft)]';

export const PW_VISIBLE_CARD_CLASS =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 shadow-[var(--desktop-shadow-soft)]';

export const PW_VISIBLE_CARD_INTERACTIVE_CLASS =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-left shadow-[var(--desktop-shadow-soft)] transition-[border-color,background-color,transform] duration-150 hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.38)] motion-reduce:transition-none motion-reduce:hover:transform-none';

export const PW_VISIBLE_PROGRESS_RAIL_CLASS =
	'grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-3';

/** Media review overlay badge: tokenized so labels survive low-GPU/reduced visual modes. */
export const PW_MEDIA_OVERLAY_BADGE_CLASS =
	'pointer-events-none rounded-(--desktop-radius-sm) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-2 py-1 text-[11px] font-medium tabular-nums text-(--desktop-text-primary) shadow-[var(--desktop-shadow-soft)]';

/** Media review split handle: visible without glow/blur dependency. */
export const PW_MEDIA_SPLIT_HANDLE_CLASS =
	'pointer-events-none absolute inset-y-0 w-0.5 bg-[rgb(var(--desktop-accent-rgb))]';

/** Media modal backdrop token used by preview surfaces. */
export const PW_MEDIA_MODAL_BACKDROP_CLASS =
	'fixed inset-0 z-250 flex items-center justify-center bg-[rgb(var(--desktop-bg-primary-rgb)/0.88)] p-4';

/** CRM capture: client + deal side by side. */
export const PW_SPLIT_CAPTURE_CLASS = 'grid gap-3 xl:grid-cols-2';

/** CRM directory: clients + deals. */
export const PW_SPLIT_DIRECTORY_CLASS = 'grid gap-3 xl:grid-cols-[1fr_1fr]';

/** Shell sidebar width (default). */
export const PW_SIDEBAR_WIDTH_CLASS = 'w-[13rem] shrink-0';

/** Shell sidebar width when surface is compact. */
export const PW_SIDEBAR_WIDTH_COMPACT_CLASS = 'w-[11rem] shrink-0';

/** Main workspace scroll region. */
export const PW_WORKSPACE_MAIN_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-8 pb-10';

/** Shell body grid: sidebar + main. */
export const PW_SHELL_BODY_CLASS =
	'flex min-h-0 flex-1 gap-3 overflow-hidden p-3';

export function pwShellBodyClass(embeddedMobileLayout?: boolean): string {
	return cn(
		PW_SHELL_BODY_CLASS,
		embeddedMobileLayout ? 'flex-col' : 'flex-row'
	);
}

export function pwSidebarPanelShellClass(
	embeddedMobileLayout?: boolean,
	compactSidebar?: boolean
): string {
	if (embeddedMobileLayout) {
		return cn(
			PW_SHELL_SIDEBAR_PANEL_CLASS,
			'w-full max-h-[min(38dvh,16rem)] shrink-0 overflow-x-auto overflow-y-hidden border-b border-(--desktop-border-subtle)'
		);
	}
	return cn(
		PW_SHELL_SIDEBAR_PANEL_CLASS,
		compactSidebar ? PW_SIDEBAR_WIDTH_COMPACT_CLASS : PW_SIDEBAR_WIDTH_CLASS
	);
}

export function pwFormGridClass(embeddedMobileLayout?: boolean): string {
	return cn('grid gap-3', !embeddedMobileLayout && 'md:grid-cols-2');
}

export function pwMetricGridClass(embeddedMobileLayout?: boolean): string {
	return cn(
		'grid grid-cols-2 gap-3',
		!embeddedMobileLayout && 'md:grid-cols-3 xl:grid-cols-5'
	);
}

export function pwSplitCaptureClass(embeddedMobileLayout?: boolean): string {
	return cn('grid gap-3', !embeddedMobileLayout && 'xl:grid-cols-2');
}

export function pwSplitDirectoryClass(embeddedMobileLayout?: boolean): string {
	return cn('grid gap-3', !embeddedMobileLayout && 'xl:grid-cols-[1fr_1fr]');
}

export function pwContextSummaryGridClass(
	embeddedMobileLayout?: boolean
): string {
	return cn(
		'grid gap-2',
		!embeddedMobileLayout && 'sm:grid-cols-2 xl:grid-cols-5'
	);
}

export function pwBrandStartersGridClass(
	embeddedMobileLayout?: boolean
): string {
	return cn('grid gap-3', !embeddedMobileLayout && 'md:grid-cols-3');
}

/** Timeline / log label tones (playbooks runner, SSE steps). */
export const PW_TONE_LABEL_CLASS = {
	neutral: 'text-(--desktop-text-primary)',
	ok: 'text-emerald-300',
	warn: 'text-amber-300',
	err: 'text-rose-300',
} as const;

export type ProfessionalWorldsTone = keyof typeof PW_TONE_LABEL_CLASS;

/** Upload / pipeline row status chip (Objects media batch). */
export const PW_PIPELINE_STATUS_CHIP_CLASS = {
	done: 'rounded-full px-2 py-px text-[11px] bg-emerald-500/20 text-emerald-300',
	failed: 'rounded-full px-2 py-px text-[11px] bg-rose-500/20 text-rose-300',
	processing:
		'rounded-full px-2 py-px text-[11px] bg-amber-500/20 text-amber-300',
	idle: 'rounded-full px-2 py-px text-[11px] bg-white/10 text-(--desktop-text-muted)',
} as const;

const PW_JOB_EVENT_SURFACE_BASE =
	'rounded-(--desktop-radius) border px-3 py-2 text-xs';

/** Job progress SSE row surface — palette aligned with `ProfessionalWorldsStatusBanner`. */
export function pwJobProgressEventSurfaceClass(eventType: string): string {
	if (eventType === 'done' || eventType === 'result') {
		return `${PW_JOB_EVENT_SURFACE_BASE} border-emerald-500/30 bg-emerald-500/10 text-emerald-100`;
	}
	if (eventType === 'warning') {
		return `${PW_JOB_EVENT_SURFACE_BASE} border-amber-500/55 bg-amber-500/10 text-amber-100`;
	}
	if (eventType === 'error') {
		return `${PW_JOB_EVENT_SURFACE_BASE} border-rose-500/30 bg-rose-500/10 text-rose-200`;
	}
	return `${PW_JOB_EVENT_SURFACE_BASE} border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)`;
}
