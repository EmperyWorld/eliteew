/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Theme token class helpers for UGS Hub — always follow desktop shell CSS variables.
 *
 * Invariants:
 * - No hardcoded slate/violet full-screen chrome; `scheme-light` / `scheme-dark` only for native controls.
 *
 * Related:
 * - features/ugs/shared/ugsDesktopUi.ts
 * - components/UGS/hub/ugsHubSharedUi.tsx
 */

import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	UGS_DESKTOP_FORM,
	UGS_DESKTOP_TABLE,
	UGS_DESKTOP_TABS,
	UGS_DESKTOP_TEXT,
	ugsDesktopSchemeClass,
} from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '@/utils/cn';

export function ugsHubIsLight(theme: DesktopShellTheme): boolean {
	return theme === 'light';
}

export function ugsHubRootClasses(theme: DesktopShellTheme): string {
	return cn(
		'relative min-h-screen bg-(--desktop-surface-app) text-(--desktop-text-primary)',
		ugsDesktopSchemeClass(theme)
	);
}

export function ugsHubRootGlowClasses(_theme: DesktopShellTheme): string {
	return 'pointer-events-none absolute inset-0 hidden';
}

export function ugsHubPanelClasses(
	_theme: DesktopShellTheme,
	className?: string
): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/85 shadow-[var(--desktop-shadow-soft)] backdrop-blur-sm',
		className
	);
}

export function ugsHubTextPrimary(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TEXT.primary;
}

export function ugsHubTextSecondary(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TEXT.secondary;
}

export function ugsHubTextMuted(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TEXT.muted;
}

export function ugsHubEyebrowClasses(theme: DesktopShellTheme): string {
	return cn(
		'text-xs font-semibold uppercase tracking-wider',
		ugsHubTextMuted(theme)
	);
}

export function ugsHubHeaderBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm font-medium text-(--desktop-text-secondary) transition hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubHeaderBtnAccentClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-3 py-2 text-sm font-medium text-(--desktop-text-primary) transition hover:border-[rgb(var(--desktop-accent-rgb)/0.5)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.18)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubTabRailClasses(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TABS.rail;
}

export function ugsHubTabActiveClasses(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TABS.active;
}

export function ugsHubTabIdleClasses(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TABS.idle;
}

export function ugsHubChipClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-3 py-1 text-xs text-(--desktop-text-muted)'
	);
}

export function ugsHubTaskCardClasses(
	_theme: DesktopShellTheme,
	selected: boolean
): string {
	return cn(
		'group min-w-0 overflow-hidden rounded-(--desktop-radius-lg) border p-4 shadow-xs transition-all duration-200 motion-reduce:transition-none md:p-5',
		selected
			? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] shadow-[var(--desktop-shadow-panel)]'
			: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/90 hover:border-(--desktop-border-strong) hover:shadow-[var(--desktop-shadow-panel)]'
	);
}

export function ugsHubModalBackdropClasses(_theme: DesktopShellTheme): string {
	return cn(
		'fixed inset-0 flex items-center justify-center p-4 backdrop-blur-xl bg-black/40'
	);
}

export function ugsHubModalPanelClasses(_theme: DesktopShellTheme): string {
	return cn(
		'relative mx-4 w-full overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) shadow-[var(--desktop-shadow-panel)]'
	);
}

export function ugsHubModalDividerClasses(_theme: DesktopShellTheme): string {
	return 'border-(--desktop-border-subtle)';
}

export function ugsHubMetaBadgeClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-muted)'
	);
}

export function ugsHubPaginationBarClasses(_theme: DesktopShellTheme): string {
	return cn(
		'mt-6 flex min-w-0 flex-col gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
	);
}

export function ugsHubPaginationBtnClasses(
	_theme: DesktopShellTheme,
	disabled: boolean
): string {
	return cn(
		'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-1.5 text-sm text-(--desktop-text-secondary) transition hover:border-(--desktop-border-strong) hover:text-(--desktop-text-primary) disabled:hover:text-(--desktop-text-secondary)',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		disabled && 'cursor-not-allowed opacity-50'
	);
}

export function ugsHubResultSectionTitleClasses(
	theme: DesktopShellTheme
): string {
	return cn('font-medium', ugsHubTextPrimary(theme));
}

export function ugsHubResultMediaPanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'min-h-24 overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 p-4'
	);
}

export function ugsHubResultCodePanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'max-h-[min(24rem,55vh)] overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-(--desktop-text-primary)'
	);
}

export function ugsHubResultCopyBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-sm text-(--desktop-text-secondary) transition-all duration-200 hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel) hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubResultDownloadAccentClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius-lg) border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:border-emerald-400/60 hover:bg-emerald-500/25 dark:text-emerald-200',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		'focus-visible:ring-offset-(--desktop-surface-app)'
	);
}

export function ugsHubResultDownloadBtnClasses(
	theme: DesktopShellTheme
): string {
	return cn(ugsHubHeaderBtnClasses(theme), 'px-3 py-1.5 text-xs');
}

export function ugsHubResultEmptyStateClasses(
	theme: DesktopShellTheme
): string {
	return cn('py-12 text-center', ugsHubTextSecondary(theme));
}

export function ugsHubResultCaptionClasses(theme: DesktopShellTheme): string {
	return cn('text-center text-xs', ugsHubTextMuted(theme));
}

export function ugsHubTaskCheckboxClasses(
	_theme: DesktopShellTheme,
	selected: boolean
): string {
	return cn(
		'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		selected
			? 'border-[rgb(var(--desktop-accent-rgb)/0.55)] bg-[rgb(var(--desktop-accent-rgb)/0.15)] text-(--desktop-text-primary)'
			: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:border-(--desktop-border-strong)'
	);
}

export function ugsHubTaskPriorityBadgeClasses(
	_theme: DesktopShellTheme,
	priority: number
): string {
	const base = 'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums';
	if (priority >= 8) {
		return cn(
			base,
			'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
		);
	}
	if (priority >= 5) {
		return cn(
			base,
			'bg-(--desktop-surface-panel) text-(--desktop-text-secondary)'
		);
	}
	return cn(base, 'bg-(--desktop-surface-soft) text-(--desktop-text-muted)');
}

export function ugsHubTaskErrorPanelClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-rose-400/35 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-900 md:col-span-2 dark:text-rose-100'
	);
}

export function ugsHubTaskErrorTitleClasses(_theme: DesktopShellTheme): string {
	return cn(
		'mb-1 flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-200'
	);
}

export function ugsHubPreviewLoadingClasses(theme: DesktopShellTheme): string {
	return cn('flex justify-center py-8 text-sm', ugsHubTextMuted(theme));
}

export function ugsHubPreviewErrorClasses(_theme: DesktopShellTheme): string {
	return cn('text-center text-sm text-rose-600 dark:text-rose-300');
}

export function ugsHubFilterSchemeClass(theme: DesktopShellTheme): string {
	return ugsDesktopSchemeClass(theme);
}

export function ugsHubFilterSearchFieldClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'w-full rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) py-2.5 pl-9 pr-3 text-sm font-medium text-(--desktop-text-primary) shadow-none outline-none transition placeholder:text-(--desktop-text-muted) focus:border-(--desktop-border-strong) focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubFilterResetBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-1 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1.5 text-xs font-semibold text-(--desktop-text-primary) transition hover:bg-(--desktop-surface-panel)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubBrandPillClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-muted)'
	);
}

export function ugsHubBrandPillIconClasses(_theme: DesktopShellTheme): string {
	return 'text-[rgb(var(--desktop-accent-rgb))]';
}

export function ugsHubIconTileClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-2 text-(--desktop-text-secondary)'
	);
}

export function ugsHubIconTileSmClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-1.5 text-(--desktop-text-secondary)'
	);
}

export function ugsHubFilterActiveChipClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-2.5 py-1 text-xs font-medium text-(--desktop-text-primary)'
	);
}

export function ugsHubTaskProgressTrackClasses(
	_theme: DesktopShellTheme
): string {
	return 'h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--desktop-surface-soft)_72%,var(--desktop-border-subtle)_28%)]';
}

export function ugsHubTaskProgressFillClasses(
	_theme: DesktopShellTheme
): string {
	return 'h-full rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.72)] shadow-[0_0_8px_rgb(var(--desktop-accent-rgb)/0.25)]';
}

export function ugsHubInsetRowClasses(_theme: DesktopShellTheme): string {
	return cn(
		'flex items-center justify-between rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/50 px-3 py-2'
	);
}

export function ugsHubTabBarDividerClasses(_theme: DesktopShellTheme): string {
	return 'border-(--desktop-border-subtle)';
}

export function ugsHubTabCountBadgeClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-full bg-(--desktop-surface-panel) px-2 py-0.5 text-xs tabular-nums text-(--desktop-text-muted)'
	);
}

export function ugsHubTextLinkAccentClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-1 text-xs text-[rgb(var(--desktop-accent-rgb))] transition hover:text-(--desktop-text-primary)',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubToolbarSelectionClasses(
	_theme: DesktopShellTheme
): string {
	return 'text-[rgb(var(--desktop-accent-rgb))]';
}

export function ugsHubInlineErrorPanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-rose-400/35 bg-rose-500/10 px-4 py-6 text-sm text-rose-900 dark:text-rose-100'
	);
}

export function ugsHubModalTableHeadClasses(_theme: DesktopShellTheme): string {
	return UGS_DESKTOP_TABLE.head;
}

export function ugsHubModalFieldClasses(_theme: DesktopShellTheme): string {
	return cn(UGS_DESKTOP_FORM.input, 'rounded-(--desktop-radius-lg)');
}

export function ugsHubModalTextareaClasses(_theme: DesktopShellTheme): string {
	return cn(
		'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 font-mono text-xs text-(--desktop-text-primary) outline-hidden ring-0 transition hover:border-(--desktop-border-strong) focus:border-[rgb(var(--desktop-accent-rgb)/0.45)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubModalSubmitBtnClasses(_theme: DesktopShellTheme): string {
	return cn(
		'inline-flex items-center gap-2 rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] px-5 py-2 text-sm font-semibold text-(--desktop-text-primary) transition hover:bg-[rgb(var(--desktop-accent-rgb)/0.2)]',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function ugsHubTaskPreviewPanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'min-h-20 min-w-0 overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/60 p-3'
	);
}

export function ugsHubTaskCategoryIconWrapClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'flex h-11 w-11 shrink-0 items-center justify-center rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary) transition-all duration-200 motion-reduce:transition-none group-hover:scale-105'
	);
}

export function ugsHubTaskCategoryBadgeClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'inline-flex items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-(--desktop-text-muted)'
	);
}

export function ugsHubEmptyStatePanelClasses(
	theme: DesktopShellTheme,
	className?: string
): string {
	return cn(
		ugsHubPanelClasses(theme, 'border-dashed p-8 text-center shadow-none'),
		className
	);
}

export function ugsHubInlineLoadingPanelClasses(
	_theme: DesktopShellTheme
): string {
	return cn(
		'flex items-center gap-4 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-6 text-(--desktop-text-primary) backdrop-blur-xl'
	);
}

export function ugsHubSkeletonBlockClasses(_theme: DesktopShellTheme): string {
	return 'rounded-(--desktop-radius-lg) bg-(--desktop-surface-panel)/80';
}
