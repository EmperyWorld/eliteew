/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout and surface class tokens for Social Hub desktop shell (premium tier).
 *
 * Invariants:
 * - Uses desktop CSS variables only; no hard-coded theme colors outside accent RGB.
 * - Section eyebrows (sidebar + home) stay sentence-case (`SH_SECTION_EYEBROW_CLASS`), not chrome uppercase shout.
 * - Home KPI labels stay sentence-case (`SH_KPI_LABEL_CLASS`); workspace panel has no accent radial wash.
 * - People directory metric chips stay sentence-case; directory panel glow is a quiet hairline (no cyan/emerald radial wash).
 * - Privacy field/audience chips stay sentence-case (`SH_PRIVACY_CHIP_ROW_CLASS` / `shPrivacyChipClass`).
 *
 * Related:
 * - SocialHubShell.tsx
 * - layout/SocialHubSidebarNav.tsx
 * - layout/SocialHubSectionLead.tsx, SocialHubKpiCard.tsx
 * - SocialHubHomeSection.tsx, SocialHubPrivacyPreviewPanel.tsx
 * - MobileAppHubPanel.tsx, SocialHubActionInboxPanel.tsx
 * - FriendList.tsx, FriendRequestList.tsx, FriendsApp.tsx
 * - FriendPersonCard.tsx
 * - documentation/product/SOCIAL-HUB.md
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export const SH_SHELL_BODY_CLASS =
	'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row';

export const SH_SHELL_BODY_COMPACT_CLASS =
	'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden';

export const SH_SHELL_SIDEBAR_PANEL_CLASS =
	'min-h-0 shrink-0 overflow-auto rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-[linear-gradient(180deg,color-mix(in_srgb,var(--desktop-surface-panel-strong)_70%,transparent)_0%,color-mix(in_srgb,var(--desktop-surface-panel)_55%,transparent)_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

export const SH_SIDEBAR_WIDTH_CLASS = 'w-full lg:w-[12rem]';

export const SH_SIDEBAR_WIDTH_COMPACT_CLASS = 'w-full shrink-0';

export const SH_SIDEBAR_NAV_COMPACT_CLASS =
	'flex flex-wrap gap-1 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/35 p-1';

/** Shared Social Hub section eyebrow — sentence-case, not DesktopAppSectionLabel shout. */
export const SH_SECTION_EYEBROW_CLASS = cn(
	DESKTOP_TYPOGRAPHY.shellMeta10,
	'font-medium tracking-normal text-(--desktop-text-muted)'
);

/** Sidebar «Разделы «Связи»» eyebrow — sentence-case padding variant. */
export const SH_SIDEBAR_SECTION_LABEL_CLASS = cn(
	SH_SECTION_EYEBROW_CLASS,
	'px-2 pb-1'
);

export const SH_WORKSPACE_MAIN_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-8';

export const SH_WORKSPACE_PANEL_CLASS = cn(
	'relative min-h-0 overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
	'bg-[linear-gradient(165deg,color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,transparent)_0%,color-mix(in_srgb,var(--desktop-surface-panel)_90%,transparent)_100%)]',
	'p-4 shadow-(--desktop-shadow-panel) backdrop-blur-xl',
	'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)]'
);

export const SH_CONTEXT_PILL_CLASS =
	'mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/55 px-3 py-1 text-[11px] font-medium tracking-wide text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const SH_SECTION_STACK_CLASS = 'grid gap-5';

export const SH_PEOPLE_SUBNAV_CLASS =
	'flex flex-wrap gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const SH_HOME_KPI_GRID_CLASS =
	'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

export function shHomeKpiGridClass(embeddedMobileLayout?: boolean): string {
	return embeddedMobileLayout
		? 'grid grid-cols-2 gap-3'
		: SH_HOME_KPI_GRID_CLASS;
}

export function shHomeOverviewColumnsClass(
	embeddedMobileLayout?: boolean
): string {
	return cn('grid gap-4', !embeddedMobileLayout && 'lg:grid-cols-3');
}

export function shInboxLoadingGridClass(
	embeddedMobileLayout?: boolean
): string {
	return cn(
		'grid gap-3',
		!embeddedMobileLayout && 'md:grid-cols-2 xl:grid-cols-3'
	);
}

export function shPrivacyAudienceGridClass(
	embeddedMobileLayout?: boolean
): string {
	return cn(
		'grid gap-3',
		!embeddedMobileLayout && 'md:grid-cols-2 xl:grid-cols-4'
	);
}

export const SH_HOME_QUICK_ACTIONS_RAIL_CLASS =
	'flex flex-wrap gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)/90 bg-(--desktop-surface-soft)/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const SH_METRIC_TILE_CLASS =
	'rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

export const SH_LIST_INTERACTIVE_ROW_CLASS = cn(
	'w-full rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-4 py-3 text-left',
	'motion-safe:transition-[border-color,background-color,box-shadow] motion-reduce:transition-none',
	'hover:border-[rgb(var(--desktop-accent-rgb))]/28 hover:bg-(--desktop-surface-soft) hover:shadow-[0_10px_28px_rgba(0,0,0,0.18)]',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--desktop-ring)'
);

export const SH_PANEL_INSET_CLASS =
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

/** Segmented control (People subnav, Home quick links). */
export function shSegmentButtonClass(active: boolean): string {
	return cn(
		'min-h-9 gap-1.5 rounded-lg px-3 text-sm font-medium motion-safe:transition-[color,background-color,border-color,box-shadow] motion-reduce:transition-none',
		active
			? 'border border-[rgb(var(--desktop-accent-rgb))]/38 bg-[rgb(var(--desktop-accent-rgb))]/14 text-(--desktop-text-primary) shadow-[0_10px_24px_rgba(8,145,178,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]'
			: 'border border-transparent text-(--desktop-text-muted) hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft)/75 hover:text-(--desktop-text-primary)'
	);
}

/** Primary sidebar nav row (vertical or compact horizontal). */
export function shSidebarNavItemClass(
	active: boolean,
	compact: boolean
): string {
	return cn(
		'relative flex items-center justify-between gap-2 text-left text-sm motion-safe:transition-colors motion-reduce:transition-none',
		compact
			? 'rounded-lg px-2.5 py-2'
			: 'rounded-(--desktop-radius) px-2.5 py-2.5',
		active
			? cn(
					'bg-[rgb(var(--desktop-accent-rgb))]/12 text-(--desktop-text-primary)',
					compact
						? 'border border-[rgb(var(--desktop-accent-rgb))]/32 shadow-[0_8px_20px_rgba(8,145,178,0.1)]'
						: 'border border-[rgb(var(--desktop-accent-rgb))]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
				)
			: 'border border-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)/80 hover:text-(--desktop-text-primary)'
	);
}

export function shSidebarNavIconClass(active: boolean): string {
	return cn(
		'h-4 w-4 shrink-0 motion-safe:transition-colors motion-reduce:transition-none',
		active ? 'text-(--desktop-accent)' : 'text-(--desktop-text-muted)'
	);
}

export function shKpiCardClass(emphasize: boolean, shellPanel: string): string {
	return cn(
		shellPanel,
		'group relative overflow-hidden p-4 text-left motion-safe:transition-[border-color,box-shadow] motion-reduce:transition-none',
		'hover:border-[rgb(var(--desktop-accent-rgb))]/32 hover:shadow-[0_14px_32px_rgba(0,0,0,0.22)]',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--desktop-ring)',
		emphasize &&
			'border-[rgb(var(--desktop-accent-rgb))]/42 bg-[rgb(var(--desktop-accent-rgb))]/10 shadow-[0_12px_28px_rgba(8,145,178,0.14)]'
	);
}

export const SH_SECTION_LEAD_WRAP_CLASS = cn(
	'relative flex flex-wrap items-start justify-between gap-3 border-b border-(--desktop-border-subtle) pb-4',
	'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(var(--desktop-accent-rgb),0.35),transparent)]'
);

export const SH_SECTION_LEAD_TITLE_CLASS = cn(
	'text-base font-semibold tracking-tight',
	DESKTOP_TYPOGRAPHY.title
);

export const SH_SECTION_LEAD_DESC_CLASS = cn(
	'max-w-3xl',
	DESKTOP_TYPOGRAPHY.bodyMuted
);

export const SH_KPI_LABEL_CLASS = cn(
	'relative flex items-center gap-2 font-medium tracking-normal text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const SH_KPI_VALUE_CLASS =
	'relative mt-3 text-3xl font-semibold tracking-tight tabular-nums';

export const SH_KPI_VALUE_EMPHASIS_CLASS = 'text-(--desktop-text-primary)';

export const SH_NAV_BADGE_CLASS =
	'min-w-4.5 shrink-0 rounded-md border border-[rgb(var(--desktop-accent-rgb))]/25 bg-[rgb(var(--desktop-accent-rgb))]/18 px-1.5 py-px text-center text-[10px] font-semibold tabular-nums tracking-normal text-(--desktop-text-primary)';

export function shPeopleSubnavBadgeClass(isRequests: boolean): string {
	return cn(
		'min-w-4.5 rounded px-1 py-px text-center text-[10px] font-semibold tabular-nums',
		isRequests
			? 'bg-[rgb(var(--desktop-accent-rgb))]/20 text-(--desktop-text-primary)'
			: 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary)'
	);
}

export function shInboxSeverityPanelClass(severity: string): string {
	if (severity === 'high') {
		return 'border-rose-400/35 bg-rose-500/10 text-rose-100';
	}
	if (severity === 'medium') {
		return 'border-amber-400/35 bg-amber-500/10 text-amber-100';
	}
	return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
}

export const SH_PANEL_HEADER_TITLE_CLASS = cn(
	'flex items-center gap-2',
	DESKTOP_TYPOGRAPHY.title
);

export const SH_PANEL_HEADER_DESC_CLASS = cn(
	'mt-1 max-w-3xl',
	DESKTOP_TYPOGRAPHY.bodyMuted
);

export const SH_INBOX_LOADING_GRID_CLASS =
	'grid gap-3 md:grid-cols-2 xl:grid-cols-3';

export const SH_METRIC_VALUE_CLASS = 'text-lg font-semibold tabular-nums';

export const SH_METRIC_LABEL_CLASS =
	'text-[10px] uppercase tracking-wide text-(--desktop-text-muted)';

export type SocialHubMetricTone = 'neutral' | 'success' | 'warning' | 'info';

export function shMetricTileToneClass(tone: SocialHubMetricTone): string {
	if (tone === 'success') {
		return 'rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2';
	}
	if (tone === 'warning') {
		return 'rounded-2xl border border-amber-300/25 bg-amber-500/10 px-3 py-2';
	}
	if (tone === 'info') {
		return 'rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2';
	}
	return SH_METRIC_TILE_CLASS;
}

export function shMetricValueToneClass(tone: SocialHubMetricTone): string {
	return cn(
		SH_METRIC_VALUE_CLASS,
		tone === 'success' && 'text-emerald-100',
		tone === 'warning' && 'text-amber-100',
		tone === 'info' && 'text-cyan-100'
	);
}

export function shMetricLabelToneClass(tone: SocialHubMetricTone): string {
	return cn(
		SH_METRIC_LABEL_CLASS,
		tone === 'success' && 'text-emerald-100/70',
		tone === 'warning' && 'text-amber-100/70',
		tone === 'info' && 'text-cyan-100/70'
	);
}

export const SH_FRIEND_INITIALS_AVATAR_CLASS =
	'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--desktop-accent-rgb))]/25 bg-[rgb(var(--desktop-accent-rgb))]/10 text-xs font-semibold text-(--desktop-accent)';

export const SH_FEED_CARD_CLASS =
	'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-3 py-2 text-xs text-(--desktop-text-muted)';

export const SH_FEED_STATUS_DOT_CLASS =
	'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))]/70';

export const SH_FEED_EVENT_BADGE_CLASS =
	'rounded-full border border-(--desktop-border-subtle) px-1.5 py-px text-[10px] uppercase tracking-wide text-(--desktop-text-dim)';

export const SH_INBOX_META_CHIP_CLASS =
	'rounded-full border border-current/15 px-1.5 py-px text-[10px] uppercase tracking-wide';

export type SocialHubPrivacyChipVariant =
	| 'info'
	| 'success'
	| 'warning'
	| 'muted';

export function shPrivacyChipClass(
	variant: SocialHubPrivacyChipVariant
): string {
	if (variant === 'info') {
		return 'rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium tracking-normal text-cyan-100';
	}
	if (variant === 'success') {
		return 'rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-medium tracking-normal text-emerald-100';
	}
	if (variant === 'warning') {
		return 'rounded-md border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium tracking-normal text-amber-100';
	}
	return 'inline-flex items-center gap-1 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1 text-[11px] font-medium tracking-normal text-(--desktop-text-muted)';
}

export function shPrivacyFieldChipClass(visible: boolean): string {
	if (visible) {
		return 'inline-flex items-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[11px] font-medium tracking-normal text-emerald-100';
	}
	return shPrivacyChipClass('muted');
}

export function shPrivacyStatusPanelClass(hasWarnings: boolean): string {
	return hasWarnings
		? 'border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100'
		: 'border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100';
}

export const SH_PRIVACY_AUDIENCE_GRID_CLASS =
	'grid gap-3 md:grid-cols-2 xl:grid-cols-4';

export const SH_PRIVACY_LOADING_GRID_CLASS = 'grid gap-3 md:grid-cols-3';

export const SH_SUBPANEL_TITLE_CLASS = 'text-sm font-semibold tracking-tight';

export const SH_SUBPANEL_HINT_CLASS =
	'mt-1 text-xs text-(--desktop-text-muted)';

export const SH_ATTENTION_ROW_CLASS = cn(
	'group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/55 px-4 py-3',
	'motion-safe:transition-[border-color,box-shadow] motion-reduce:transition-none',
	'hover:border-[rgb(var(--desktop-accent-rgb))]/30 hover:shadow-[0_10px_24px_rgba(0,0,0,0.16)] sm:flex-row sm:items-center sm:justify-between'
);

export const SH_ATTENTION_ROW_ACCENT_CLASS =
	'pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-[rgb(var(--desktop-accent-rgb))]/45 opacity-70';

export const SH_CONTEXT_PILL_DOT_CLASS =
	'h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))]/70';

export const SH_FEED_TIMESTAMP_CLASS =
	'text-[10px] uppercase tracking-wide text-(--desktop-text-dim)';

export const SH_INBOX_CARD_ICON_WRAP_CLASS =
	'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-current/20 bg-current/10';

export const SH_INBOX_CARD_TITLE_CLASS = 'truncate text-sm font-semibold';

export const SH_INBOX_CARD_META_TIMESTAMP_CLASS =
	'text-[10px] uppercase tracking-wide opacity-75';

export const SH_PRIVACY_AUDIENCE_TITLE_CLASS =
	'truncate text-sm font-semibold text-(--desktop-text-primary)';

export const SH_PRIVACY_CHIP_ROW_CLASS = cn(
	'relative flex flex-wrap gap-1.5 font-medium tracking-normal',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const SH_MOBILE_OVERVIEW_GRID_CLASS =
	'grid gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 p-4 sm:grid-cols-2 xl:grid-cols-4';

export const SH_MOBILE_FIELD_LABEL_CLASS =
	'text-xs uppercase tracking-wide text-(--desktop-text-muted)';

export const SH_MOBILE_FIELD_VALUE_CLASS = 'mt-1 text-sm font-medium';

export const SH_MOBILE_FIELD_HINT_CLASS =
	'mt-0.5 text-xs text-(--desktop-text-muted)';

export const SH_MOBILE_DOWNLOAD_PANEL_CLASS =
	'rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb))]/22 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(var(--desktop-accent-rgb),0.12),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--desktop-surface-soft)_80%,transparent)_0%,transparent_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

export const SH_MOBILE_HISTORY_SUMMARY_GRID_CLASS =
	'mb-3 grid gap-2 sm:grid-cols-3';

export const SH_MOBILE_HISTORY_LATEST_VALUE_CLASS =
	'truncate text-sm font-semibold text-emerald-100';

export const SH_MOBILE_HISTORY_ROW_CLASS =
	'rounded-(--desktop-radius-md) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/35 px-3 py-2';

export const SH_MOBILE_HISTORY_LIST_CLASS =
	'max-h-48 space-y-2 overflow-y-auto pr-1 text-sm';

export const SH_MOBILE_EMPTY_HISTORY_PANEL_CLASS =
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 p-4 text-sm';

export const SH_DIRECTORY_PANEL_GLOW_FRIENDS_CLASS =
	'pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]';

export function shDirectoryPanelGlowClass(
	_variant: 'friends' | 'incoming' | 'sent'
): string {
	return SH_DIRECTORY_PANEL_GLOW_FRIENDS_CLASS;
}

export const SH_DIRECTORY_LIST_TITLE_CLASS =
	'text-sm font-medium text-(--desktop-text-secondary)';

export const SH_DIRECTORY_DESC_CLASS =
	'mt-1 text-xs leading-relaxed text-(--desktop-text-muted)';

export const SH_DIRECTORY_METRIC_ROW_CLASS = cn(
	'mt-2 flex flex-wrap gap-1.5 font-medium tracking-normal text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export type SocialHubDirectoryMetricChip =
	| 'neutral'
	| 'favorite'
	| 'limitedClear'
	| 'limitedAlert'
	| 'incoming'
	| 'sent';

export function shDirectoryMetricChipClass(
	variant: SocialHubDirectoryMetricChip
): string {
	const base = 'rounded-md border px-2 py-1 tracking-normal';
	if (variant === 'favorite') {
		return cn(base, 'border-amber-300/25 bg-amber-500/10 text-amber-100');
	}
	if (variant === 'limitedAlert') {
		return cn(base, 'border-rose-300/25 bg-rose-500/10 text-rose-100');
	}
	if (variant === 'limitedClear') {
		return cn(base, 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100');
	}
	if (variant === 'incoming') {
		return cn(base, 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100');
	}
	if (variant === 'sent') {
		return cn(base, 'border-violet-300/25 bg-violet-500/10 text-violet-100');
	}
	return cn(
		base,
		'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 text-(--desktop-text-muted)'
	);
}

export function shDirectoryCountBadgeClass(
	insetClass: string,
	variant: 'neutral' | 'incoming' | 'sent' = 'neutral'
): string {
	return cn(
		insetClass,
		'rounded-full px-2 py-0.5 text-[10px] font-semibold',
		variant === 'incoming' && 'text-emerald-100',
		variant === 'sent' && 'text-violet-100',
		variant === 'neutral' && 'text-(--desktop-text-muted)'
	);
}

export const SH_DIRECTORY_FILTER_WRAP_CLASS =
	'relative mb-4 flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center';

export const SH_DIRECTORY_LOADING_WRAP_CLASS =
	'flex items-center justify-center py-8 text-slate-500';

export const SH_DIRECTORY_HUB_HEADER_CLASS =
	'border-b border-(--desktop-border-subtle) px-4 py-3 sm:px-5 sm:py-4';

export const SH_DIRECTORY_HUB_LABEL_CLASS =
	'flex min-w-0 items-center gap-2 text-sm font-medium text-(--desktop-text-secondary)';

export const SH_REQUEST_AGE_BADGE_CLASS =
	'mt-1 inline-flex rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--desktop-text-muted)';

export const SH_FRIEND_LIST_ROW_ACCENT_CLASS =
	'absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-linear-to-b from-cyan-300 via-sky-400 to-emerald-300';

export const SH_REQUEST_ROW_HOVER_ACCENT_CLASS =
	'pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-[rgb(var(--desktop-accent-rgb))]/35 opacity-0 transition-opacity group-hover:opacity-100';

export function shFriendListRowClass(
	isSelected: boolean,
	rowIdle: string
): string {
	return cn(
		'group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border px-3 py-3 motion-safe:transition motion-reduce:transition-none',
		isSelected
			? 'border-cyan-400/35 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(16,185,129,0.06))] shadow-[0_12px_30px_rgba(8,145,178,0.18),0_0_0_1px_rgba(34,211,238,0.08)_inset]'
			: cn(
					rowIdle,
					'hover:border-cyan-500/25 hover:bg-(--desktop-surface-soft)/70 active:scale-[0.99] motion-reduce:active:scale-100'
				)
	);
}

export function shRequestListRowClass(
	flashKind: 'accepted' | 'rejected' | null,
	rowIdle: string
): string {
	return cn(
		'group relative flex flex-col gap-2 overflow-hidden rounded-2xl border px-2 py-2 motion-safe:transition motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:gap-3',
		flashKind === 'accepted'
			? 'border-emerald-500/35 bg-emerald-500/10'
			: flashKind === 'rejected'
				? 'border-rose-500/25 bg-rose-500/5'
				: cn(
						rowIdle,
						'bg-(--desktop-surface-soft)/50 hover:border-cyan-500/25 hover:bg-(--desktop-surface-soft)/70'
					)
	);
}

export function shDirectoryFlashPanelClass(tone: 'success' | 'danger'): string {
	return cn(
		'p-4 text-sm motion-safe:transition motion-reduce:transition-none',
		tone === 'success'
			? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
			: 'border-rose-500/25 bg-rose-500/10 text-rose-100'
	);
}

export const SH_FRIEND_CARD_TOOLBAR_TITLE_CLASS =
	'flex items-center gap-2 text-sm font-semibold text-(--desktop-text-primary)';

export const SH_FRIEND_CARD_HERO_CLASS =
	'relative -mx-5 overflow-hidden border-b border-(--desktop-border-subtle) bg-[radial-gradient(circle_at_top_left,rgba(var(--desktop-accent-rgb),0.2),transparent_58%),linear-gradient(135deg,var(--desktop-surface-soft),transparent)] px-5 py-5';

export const SH_FRIEND_CARD_DISPLAY_NAME_CLASS =
	'truncate text-lg font-semibold text-(--desktop-text-primary)';

export const SH_FRIEND_CARD_USERNAME_CLASS =
	'truncate text-sm text-(--desktop-text-muted) antialiased';

export type FriendCardStatusBadge =
	| 'favorite'
	| 'muted'
	| 'blocked'
	| 'activityHidden'
	| 'neutral'
	| 'circle';

export function shFriendCardStatusBadgeClass(
	variant: FriendCardStatusBadge
): string {
	if (variant === 'favorite') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
	}
	if (variant === 'muted') {
		return 'border-slate-500/30 bg-slate-500/10 text-slate-200';
	}
	if (variant === 'blocked') {
		return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
	}
	if (variant === 'activityHidden') {
		return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
	}
	if (variant === 'circle') {
		return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
	}
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)';
}

export function shFriendCardQuickMetricClass(shellInset: string): string {
	return cn(shellInset, 'rounded-2xl px-3 py-2.5');
}

export const SH_FRIEND_CARD_QUICK_METRIC_VALUE_CLASS =
	'mt-1 truncate text-sm font-medium text-(--desktop-text-primary)';

export const SH_FRIEND_CARD_TABLIST_CLASS =
	'sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/90 p-1 backdrop-blur-xl';

export function shFriendCardTabClass(active: boolean): string {
	return cn(
		'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium transition',
		active
			? 'bg-[rgb(var(--desktop-accent-rgb))]/18 text-(--desktop-text-primary)'
			: 'text-(--desktop-text-muted) hover:bg-(--desktop-surface-raised)'
	);
}

export function shFriendCardTabBadgeClass(active: boolean): string {
	return cn(
		'rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums',
		active
			? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
			: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
	);
}

export const SH_FRIEND_CARD_SECTION_TITLE_CLASS =
	'text-sm font-medium text-(--desktop-text-secondary)';

export function shFriendCardInsetSectionClass(shellInset: string): string {
	return cn(shellInset, 'rounded-2xl p-4');
}

export const SH_FRIEND_CARD_SHARED_METRICS_GRID_CLASS =
	'mt-4 grid gap-2 sm:grid-cols-3';

export const SH_FRIEND_CARD_LIST_ITEM_CLASS =
	'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-3 text-sm';

export const SH_FRIEND_CARD_LIST_ITEM_COMPACT_CLASS =
	'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 px-3 py-2 text-sm';

export const SH_FRIEND_CARD_EMPTY_INSET_CLASS =
	'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 py-6';

export const SH_FRIEND_CARD_REPORT_PANEL_CLASS =
	'mt-3 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4';

export const SH_FRIEND_CARD_REMINDER_PANEL_CLASS =
	'rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 px-3 py-2 sm:col-span-2';

export const SH_FRIEND_CARD_LOADING_LABEL_CLASS =
	'text-sm font-medium text-(--desktop-text-secondary)';
