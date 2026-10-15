/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Surface tokens for UGS Workflows tab — desktop shell CSS variables only.
 *
 * Invariants:
 * - Follows `#desktop-main[data-theme]`; no isolated slate/violet chrome.
 *
 * Related:
 * - UGSWorkflowsTab.tsx, WorkflowCard.tsx, ugsHubThemeTokens.ts
 */

import type { DesktopShellTheme } from '../../../hooks/useDesktopShellTheme';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../pages/Desktop/components/DesktopAppChrome';
import {
	UGS_DESKTOP_BTN,
	UGS_DESKTOP_FORM,
	UGS_INFO_BADGE,
	ugsWorkflowExecutionStatusBadgeClass,
} from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '../../../utils/cn';
import {
	ugsHubHeaderBtnClasses,
	ugsHubMetaBadgeClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
	ugsHubFilterActiveChipClasses,
	ugsHubFilterResetBtnClasses,
	ugsHubFilterSchemeClass,
} from '../hub/ugsHubThemeTokens';

export { ugsHubTextMuted, ugsHubTextPrimary, ugsHubTextSecondary };

export function workflowsToolbarPanelClasses(theme: DesktopShellTheme): string {
	return cn(ugsHubPanelClasses(theme), 'px-3 py-2.5');
}

export function workflowsSearchFieldClasses(_theme: DesktopShellTheme): string {
	return cn(
		'w-full rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) py-2 pl-8 pr-2.5 text-sm text-(--desktop-text-primary) outline-none transition placeholder:text-(--desktop-text-muted) focus:border-[rgb(var(--desktop-accent-rgb)/0.4)] focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.15)]'
	);
}

export function workflowsFilterSchemeClass(theme: DesktopShellTheme): string {
	return ugsHubFilterSchemeClass(theme);
}

export function workflowsCompactBtnClasses(
	theme: DesktopShellTheme,
	variant: 'default' | 'autoOn' | 'autoOff' | 'import' | 'create' = 'default'
): string {
	const base = cn(
		'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
	if (variant === 'autoOn') {
		return cn(
			base,
			'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 hover:border-emerald-500/50 dark:text-emerald-200'
		);
	}
	if (variant === 'autoOff') {
		return cn(
			base,
			'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:border-(--desktop-border-strong)'
		);
	}
	if (variant === 'import') {
		return cn(
			base,
			'border-sky-500/35 bg-sky-500/10 text-sky-800 hover:border-sky-500/50 dark:text-sky-200'
		);
	}
	if (variant === 'create') {
		return cn(
			base,
			'px-3 font-semibold shadow-[var(--desktop-shadow-soft)]',
			'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-accent-rgb)/0.18)]'
		);
	}
	return ugsHubHeaderBtnClasses(theme);
}

export function workflowsEmptyStateClasses(_theme: DesktopShellTheme): string {
	return cn(
		'relative overflow-hidden rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-6 text-center sm:p-8'
	);
}

export function workflowCardClasses(_theme: DesktopShellTheme): string {
	return cn(
		'group rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/90 p-6 shadow-[var(--desktop-shadow-soft)] transition-all duration-200 motion-reduce:transition-none hover:border-(--desktop-border-strong) hover:shadow-[var(--desktop-shadow-panel)]'
	);
}

export function workflowCardStatClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/70 p-2'
	);
}

export function workflowCardMenuPanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'min-w-[150px] rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-1 shadow-[var(--desktop-shadow-panel)]'
	);
}

export function workflowCardIconWrapClasses(_theme: DesktopShellTheme): string {
	return cn(
		'flex h-12 w-12 items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)'
	);
}

export function workflowsFieldClasses(_theme: DesktopShellTheme): string {
	return cn(
		UGS_DESKTOP_FORM.input,
		'rounded-(--desktop-radius-lg) px-4 py-3 focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:ring-[rgb(var(--desktop-accent-rgb)/0.15)]'
	);
}

export function workflowsFieldLabelClasses(theme: DesktopShellTheme): string {
	return cn('mb-2 block text-sm font-medium', ugsHubTextSecondary(theme));
}

export function workflowsErrorAlertFullClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-rose-400/35 bg-rose-500/10 p-6 text-center text-rose-900 shadow-[var(--desktop-shadow-soft)] dark:text-rose-50'
	);
}

export function workflowsErrorAlertInlineClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'flex flex-wrap items-center justify-between gap-3 rounded-(--desktop-radius-lg) border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-900 dark:text-rose-50'
	);
}

export function workflowsErrorRetryBtnClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius-lg) border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-500/25 dark:text-rose-50',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function workflowsErrorRetryBtnCompactClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-900 transition hover:bg-rose-500/25 dark:text-rose-50',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function workflowsWarningAlertClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-950 shadow-[var(--desktop-shadow-soft)] dark:text-amber-50'
	);
}

export function workflowsWarningDetailClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'mt-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-950 dark:text-amber-50'
	);
}

export function workflowsEmptyHeroIconClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'relative z-1 mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) shadow-[var(--desktop-shadow-panel)]'
	);
}

export function workflowsModalErrorClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-900 dark:text-rose-50'
	);
}

export function workflowCardMetaBadgeClasses(theme: DesktopShellTheme): string {
	return ugsHubMetaBadgeClasses(theme);
}

export function workflowCardExecutionEmptyClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'rounded-lg border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 p-3 text-xs text-(--desktop-text-muted)'
	);
}

export function workflowCardExecutionRowClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 p-2 text-xs'
	);
}

export function workflowCardFooterDividerClasses(
	_theme: DesktopShellTheme
): string {
	return 'border-(--desktop-border-subtle)';
}

export function workflowCardIconBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs font-medium text-(--desktop-text-secondary) transition hover:border-(--desktop-border-strong) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function workflowCardMenuItemClasses(_theme: DesktopShellTheme): string {
	return cn(
		'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-(--desktop-text-secondary) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
	);
}

export function workflowCardDisabledNoteClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-3 py-2 text-xs font-medium text-(--desktop-text-muted)'
	);
}

export function workflowCardPublicBadgeClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-800 dark:text-emerald-200'
	);
}

export function workflowCardSourceBadgeClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium',
		UGS_INFO_BADGE
	);
}

export function workflowCardCatalogNoteClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'mb-4 rounded-(--desktop-radius-lg) border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100'
	);
}

export function workflowCardExecutionStatusBadgeClasses(
	status: string
): string {
	return cn(
		'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium',
		ugsWorkflowExecutionStatusBadgeClass(status)
	);
}

export function workflowCardExecutionErrorClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'mt-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[11px] leading-relaxed text-rose-900 dark:text-rose-100'
	);
}

export function workflowCardExecuteBtnClasses(canExecute: boolean): string {
	return cn(
		'inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-(--desktop-radius-lg) border px-3 py-2 text-xs font-medium transition',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		canExecute
			? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-800 hover:border-emerald-500/50 hover:bg-emerald-500/18 dark:text-emerald-200'
			: 'cursor-not-allowed border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
	);
}

export function workflowCardOpenBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-3 py-2 text-xs font-medium text-(--desktop-text-primary) transition hover:bg-[rgb(var(--desktop-accent-rgb)/0.2)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function workflowCardDeleteMenuItemClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-rose-700 transition hover:bg-rose-500/10 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200'
	);
}

export function workflowQuickExecuteSubmitBtnClasses(): string {
	return cn(
		UGS_DESKTOP_BTN.primary,
		'rounded-(--desktop-radius-lg) border-emerald-500/35 bg-emerald-500/14 hover:bg-emerald-500/22 disabled:cursor-not-allowed disabled:opacity-60'
	);
}

export function workflowsFilterActiveChipClasses(
	theme: DesktopShellTheme
): string {
	return ugsHubFilterActiveChipClasses(theme);
}

export function workflowsFilterResetBtnClasses(
	theme: DesktopShellTheme
): string {
	return ugsHubFilterResetBtnClasses(theme);
}
