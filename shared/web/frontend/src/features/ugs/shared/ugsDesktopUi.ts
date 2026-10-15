/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind classes for UGS surfaces — always uses desktop shell CSS variables.
 *
 * Invariants:
 * - Follow `#desktop-main[data-theme]` tokens from DesktopSettingsPanel; no hardcoded slate/violet shell.
 *
 * Related:
 * - components/UGS/hub/ugsHubSharedUi.tsx
 * - pages/Desktop/components/DesktopAppChrome.tsx
 */

import type { CSSProperties } from 'react';

import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export function ugsDesktopSchemeClass(theme: DesktopShellTheme): string {
	return theme === 'light' ? 'scheme-light' : 'scheme-dark';
}

/** Root shell for any UGS view inside desktop window. */
export const UGS_DESKTOP_ROOT =
	'bg-(--desktop-surface-app) text-(--desktop-text-primary)';

export const UGS_DESKTOP_TEXT = {
	primary: 'text-(--desktop-text-primary)',
	secondary: 'text-(--desktop-text-secondary)',
	muted: 'text-(--desktop-text-muted)',
} as const;

export const UGS_DESKTOP_SURFACE = {
	panel:
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) shadow-[var(--desktop-shadow-soft)]',
	soft: 'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
	softTranslucent:
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/85',
	inset:
		'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,var(--desktop-surface-app)_18%)]',
} as const;

export const UGS_DESKTOP_FORM = {
	input:
		'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted) shadow-xs transition focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.35)] disabled:cursor-not-allowed disabled:opacity-60',
	textarea:
		'min-h-[160px] w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-muted) shadow-xs transition focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.35)] disabled:cursor-not-allowed disabled:opacity-60',
	label: 'font-medium text-(--desktop-text-secondary)',
	hint: 'text-xs text-(--desktop-text-muted)',
	field: 'flex flex-col gap-1 text-sm text-(--desktop-text-secondary)',
} as const;

export const UGS_DESKTOP_TABLE = {
	wrap: 'overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)',
	head: 'bg-(--desktop-surface-soft) text-xs uppercase tracking-[0.16em] text-(--desktop-text-muted)',
	row: 'border-t border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover)/40',
	cell: 'px-4 py-3 text-(--desktop-text-secondary)',
	cellMono:
		'px-4 py-3 font-mono text-[0.8125rem] text-(--desktop-text-secondary)',
	cellStrong: 'px-4 py-3 font-semibold text-(--desktop-text-primary)',
	footer:
		'flex items-center justify-between gap-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-4 py-3 text-xs text-(--desktop-text-muted)',
	empty: 'px-4 py-8 text-center text-(--desktop-text-muted)',
} as const;

export const UGS_DESKTOP_BTN = {
	secondary: cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-2 text-sm font-medium text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
	ghost: cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius) border border-transparent px-4 py-2 text-sm font-medium text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
	primary: cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] px-4 py-2 text-sm font-medium text-(--desktop-text-primary) transition hover:bg-[rgb(var(--desktop-accent-rgb)/0.22)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
	danger: cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius) border border-rose-500/35 bg-rose-600/15 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-600/25 dark:text-rose-200',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
} as const;

export const UGS_DESKTOP_TABS = {
	rail: 'flex flex-wrap gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-1',
	active: cn(
		'flex items-center gap-2 rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-3.5 py-2 text-sm font-medium text-(--desktop-text-primary) shadow-sm',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
	idle: cn(
		'flex items-center gap-2 rounded-(--desktop-radius) px-3.5 py-2 text-sm font-medium text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	),
} as const;

export const ugsAdminOverviewCardClass = cn(
	UGS_DESKTOP_SURFACE.soft,
	'p-5 sm:p-6 transition-[box-shadow,border-color] duration-200 hover:border-(--desktop-border-strong) hover:shadow-[var(--desktop-shadow-panel)]'
);

export const ugsAdminEntityCardClass = cn(
	UGS_DESKTOP_SURFACE.soft,
	'p-5 transition-[box-shadow,border-color] duration-200 hover:border-(--desktop-border-strong)'
);

export const ugsAdminCardHeaderRowClass =
	'flex flex-wrap items-start justify-between gap-3 border-b border-(--desktop-border-subtle) pb-4';

/** KPI / stat tile in Dashboard and Analytics. */
export const ugsWorkspaceMetricCardClass = cn(
	UGS_DESKTOP_SURFACE.soft,
	'p-4 transition-[box-shadow,border-color,transform] duration-200 motion-reduce:transition-none hover:border-(--desktop-border-strong) hover:shadow-[var(--desktop-shadow-panel)]'
);

/** Clickable navigation tile (Dashboard shortcuts). */
export const ugsWorkspaceShortcutTileClass = cn(
	ugsWorkspaceMetricCardClass,
	'flex min-h-11 w-full items-start gap-3 text-left hover:-translate-y-px motion-reduce:hover:translate-y-0'
);

export const UGS_WORKSPACE_SEMANTIC = {
	success: 'text-emerald-600 dark:text-emerald-400',
	warning: 'text-amber-600 dark:text-amber-400',
	danger: 'text-rose-600 dark:text-rose-400',
	successDot: 'bg-emerald-400',
	warningDot: 'bg-amber-400',
	dangerDot: 'bg-rose-400',
	warningBanner:
		'rounded-(--desktop-radius-lg) border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100',
	warningBadge:
		'rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100',
} as const;

export const UGS_SEVERITY_BADGE = {
	error:
		'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-rose-500/15 text-rose-800 dark:text-rose-200',
	warning:
		'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-900 dark:text-amber-200',
	info: 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-sky-500/15 text-sky-800 dark:text-sky-200',
} as const;

export const UGS_ACTIVE_STATE_BADGE = {
	active:
		'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
	inactive:
		'inline-flex rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-xs font-medium text-(--desktop-text-muted)',
} as const;

export const UGS_QUEUE_OPS_STATUS_BADGE = {
	healthy:
		'rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-100',
	degraded:
		'rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-100',
	unknown:
		'rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-secondary)',
} as const;

export const UGS_INFO_BADGE =
	'rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-100';

export const ugsQueueOpsDetailPanelClass = cn(UGS_DESKTOP_SURFACE.inset, 'p-3');

export function ugsQueueOpsStatusBadgeClass(
	status: string | undefined
): string {
	if (status === 'healthy') return UGS_QUEUE_OPS_STATUS_BADGE.healthy;
	if (status === 'degraded') return UGS_QUEUE_OPS_STATUS_BADGE.degraded;
	return UGS_QUEUE_OPS_STATUS_BADGE.unknown;
}

/** Execution row status in workflow cards (Hub → Workflows). */
export const UGS_WORKFLOW_EXECUTION_STATUS_BADGE = {
	completed:
		'border-emerald-500/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
	failed: 'border-rose-500/35 bg-rose-500/12 text-rose-800 dark:text-rose-200',
	running: 'border-sky-500/35 bg-sky-500/12 text-sky-800 dark:text-sky-200',
	pending:
		'border-amber-500/35 bg-amber-500/12 text-amber-900 dark:text-amber-200',
	default:
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
} as const;

export function ugsWorkflowExecutionStatusBadgeClass(status: string): string {
	switch (status) {
		case 'completed':
			return UGS_WORKFLOW_EXECUTION_STATUS_BADGE.completed;
		case 'failed':
			return UGS_WORKFLOW_EXECUTION_STATUS_BADGE.failed;
		case 'running':
			return UGS_WORKFLOW_EXECUTION_STATUS_BADGE.running;
		case 'pending':
			return UGS_WORKFLOW_EXECUTION_STATUS_BADGE.pending;
		default:
			return UGS_WORKFLOW_EXECUTION_STATUS_BADGE.default;
	}
}

export function ugsDesktopChartTooltipStyle(
	theme: DesktopShellTheme
): CSSProperties {
	return {
		background:
			theme === 'light'
				? 'var(--desktop-surface-panel)'
				: 'color-mix(in srgb, var(--desktop-surface-panel) 94%, transparent)',
		border: '1px solid var(--desktop-border-subtle)',
		borderRadius: 'var(--desktop-radius-lg)',
		color: 'var(--desktop-text-primary)',
		boxShadow: 'var(--desktop-shadow-soft)',
		fontSize: '12px',
	};
}

export function ugsDesktopChartGridStroke(theme: DesktopShellTheme): string {
	return theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
}
