/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Status/category badge classes and i18n helpers for UGS Hub task list rows.
 *
 * Invariants:
 * - Visible status/category labels come from `ugsHub` i18n (`status.*` / `category.*`).
 *
 * Related:
 * - components/UGS/hub/UgsHubTaskList.tsx
 * - components/UGSHub.tsx
 */

import type { TFunction } from 'i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import type { DesktopShellTheme } from '../../../hooks/useDesktopShellTheme';

/** Semantic status pills — readable in light and dark desktop themes. */
export const UGS_HUB_STATUS_BADGE_CLASSES: Record<UGSTask['status'], string> = {
	queued:
		'border border-amber-400/30 bg-amber-500/12 text-amber-800 dark:text-amber-200',
	pending:
		'border border-amber-400/30 bg-amber-500/12 text-amber-800 dark:text-amber-200',
	processing:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)',
	retrying:
		'border border-amber-400/35 bg-amber-500/15 text-amber-800 dark:text-amber-200',
	completed:
		'border border-emerald-400/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
	failed:
		'border border-rose-400/35 bg-rose-500/12 text-rose-800 dark:text-rose-200',
	cancelled:
		'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)',
};

export function ugsHubStatusBadgeClasses(
	_theme: DesktopShellTheme,
	status: UGSTask['status']
): string {
	return UGS_HUB_STATUS_BADGE_CLASSES[status];
}

export const UGS_HUB_STATUS_DOT_CLASSES: Record<UGSTask['status'], string> = {
	queued: 'bg-amber-400/90 animate-pulse',
	pending: 'bg-amber-400/80',
	processing: 'bg-[rgb(var(--desktop-accent-rgb)/0.75)] animate-pulse',
	retrying: 'bg-amber-400/85 animate-pulse',
	completed: 'bg-emerald-400/85',
	failed: 'bg-rose-400/85',
	cancelled: 'bg-(--desktop-text-muted)',
};

const CATEGORY_SURFACE =
	'from-[color-mix(in_srgb,var(--desktop-surface-panel)_90%,transparent)] to-(--desktop-surface-soft)';

export const UGS_HUB_CATEGORY_META: Record<
	string,
	{ gradient: string; accent: string }
> = {
	text: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	image: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	audio: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	video: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	document: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	analysis: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	composite: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	workflows: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-secondary)',
	},
	default: {
		gradient: CATEGORY_SURFACE,
		accent: 'text-(--desktop-text-muted)',
	},
};

export function ugsHubStatusLabel(
	t: TFunction<'ugsHub'>,
	status: UGSTask['status']
): string {
	return t(`status.${status}`);
}

export function ugsHubCategoryLabel(
	t: TFunction<'ugsHub'>,
	category: string | null | undefined
): string {
	const key =
		category && category in UGS_HUB_CATEGORY_META ? category : 'default';
	return t(`category.${key}`);
}

export function buildUgsHubCategoryLabelMap(
	t: TFunction<'ugsHub'>
): Record<string, string> {
	return Object.fromEntries(
		Object.keys(UGS_HUB_CATEGORY_META).map((key) => [key, t(`category.${key}`)])
	);
}
