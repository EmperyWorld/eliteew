/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout and typography class tokens for Notification Center (taskbar flyout + full window).
 *
 * Invariants:
 * - Uses desktop CSS variables only; semantic type/source colors stay in notificationHubStyles.ts.
 * - Typography via DESKTOP_TYPOGRAPHY; confirm modal z-index via useEmbeddedPortaledModalZIndex.
 *
 * Related:
 * - NotificationCenter.tsx, NotificationHubBody.tsx, NotificationHubItem.tsx
 * - NotificationHubQuickSettings.tsx, NotificationHubVirtualLists.tsx
 * - NotificationHubClearConfirm.tsx, notificationHubStyles.ts
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-APP.md
 */

import {
	DESKTOP_LUCIDE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../constants';
import type { NotificationHubExtensionSlot } from '../../notifications/notificationHubExtensionRegistry';
import { cn } from '@/utils/cn';

/** Taskbar flyout header shell. */
export const NH_CENTER_HEADER_WRAP_CLASS = cn(
	'shrink-0 border-b border-(--desktop-border-subtle)',
	DESKTOP_SURFACE.spacingLg
);

export const NH_CENTER_OPEN_FULL_BUTTON_CLASS =
	'mt-2 w-full justify-center gap-1.5 text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)';

export const NH_UNREAD_COUNT_BADGE_CLASS =
	'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)';

/** Window settings block (search, source filter, read/unread). */
export const NH_SETTINGS_BLOCK_CLASS = cn(
	DESKTOP_SURFACE.spacingLg,
	'w-full border-b border-(--desktop-border-subtle)'
);

/** Panel filter bar (all / unread + type chips). */
export const NH_PANEL_FILTER_BAR_CLASS =
	'shrink-0 border-b border-(--desktop-border-subtle) px-3 py-2.5 sm:px-3.5';

export const NH_FILTER_ROW_CLASS = 'flex gap-2';

export const NH_TYPE_CHIP_ROW_CLASS = 'mt-2 flex flex-wrap gap-1';

/** Muted hint under panel filters pointing to full-window Quick Settings. */
export const NH_PANEL_QUICK_SETTINGS_HINT_CLASS = cn(
	'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_SOURCE_FILTER_WRAP_CLASS = 'mt-3 flex flex-col gap-1.5';

export const NH_SOURCE_CHIP_ROW_CLASS = 'flex flex-wrap gap-1';

export const NH_GROUP_BY_WRAP_CLASS = 'mt-3 flex flex-col gap-1.5';

export const NH_GROUP_BY_CHIP_ROW_CLASS = 'flex flex-wrap gap-1';

export const NH_SECTION_LABEL_NORMAL_CLASS = 'tracking-normal normal-case';

export const NH_HINT_TEXT_CLASS = cn(
	'text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_VIRTUAL_FEED_HINT_CLASS = cn(
	'mb-2 text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_WINDOW_FILTER_ACTIONS_CLASS = cn('mt-3 flex gap-2 pb-4');

export const NH_WINDOW_FEED_WRAP_CLASS =
	'flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2 sm:px-5';

export const NH_WINDOW_SCROLL_FEED_WRAP_CLASS =
	'w-full flex-1 space-y-4 p-4 sm:p-5';

export const NH_EMPTY_CENTER_WRAP_CLASS =
	'flex flex-1 flex-col items-center justify-center px-3 py-8';

export const NH_EMPTY_WINDOW_WRAP_CLASS = 'py-8';

export const NH_RESET_FILTERS_WRAP_CLASS = 'mt-4 flex justify-center';

export const NH_GROUP_HEADER_ROW_CLASS =
	'flex items-center justify-between gap-2';

export const NH_PINNED_SECTION_STACK_CLASS = 'space-y-2';

export const NH_FEED_GROUPS_STACK_CLASS = 'space-y-4';

export const NH_SOURCE_GROUP_DETAILS_CLASS =
	'group space-y-2 [&_summary::-webkit-details-marker]:hidden';

export const NH_SOURCE_GROUP_SUMMARY_CLASS =
	'cursor-pointer list-none rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5';

export const NH_SOURCE_GROUP_BODY_CLASS =
	'space-y-2 border-t border-(--desktop-border-subtle) pt-3';

export const NH_SOURCE_GROUP_CHEVRON_CLASS =
	'h-4 w-4 shrink-0 text-(--desktop-text-muted) transition-transform group-open:rotate-90';

export const NH_FOOTER_TOOLBAR_CLASS =
	'shrink-0 flex-wrap gap-2 border-t border-(--desktop-border-subtle) p-3';

export const NH_SETTINGS_LOADING_CLASS = DESKTOP_TYPOGRAPHY.caption;

export const NH_QUICK_SETTINGS_SECTION_CARD_CLASS =
	'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3';

export const NH_QUICK_SETTINGS_CONTROL_TILE_CLASS = 'flex-col gap-1 p-3';

/** Full-window NotificationsApp root shell. */
export const NH_WINDOW_APP_SHELL_CLASS =
	'flex h-full min-h-0 flex-col bg-(--desktop-surface-panel)/40';

export const NH_QUICK_SETTINGS_SECTION_STACK_CLASS = 'flex flex-col gap-2';

export const NH_QUICK_SETTINGS_SECTION_DESC_CLASS = cn(
	'leading-snug',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_QUICK_SETTINGS_PREF_ROW_CLASS =
	'flex flex-col gap-1.5 rounded-(--desktop-radius-md) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-2';

export const NH_QUICK_SETTINGS_PREF_ROW_LABEL_CLASS = cn(
	'font-medium text-(--desktop-text-secondary)',
	DESKTOP_TYPOGRAPHY.captionInherit
);

export const NH_QUICK_SETTINGS_TOGGLE_ROW_CLASS = 'flex flex-wrap gap-1';

export function nhQuickSettingsToggleButtonClass(): string {
	return cn('px-2 py-1', DESKTOP_TYPOGRAPHY.small);
}

export const NH_QUICK_SETTINGS_ROOT_CLASS = 'space-y-3';

export const NH_QUICK_SETTINGS_GRID_CLASS = 'grid gap-3 xl:grid-cols-2';

export const NH_QUICK_SETTINGS_CONTROL_GRID_CLASS =
	'mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3';

export const NH_QUICK_SETTINGS_CONTROL_LABEL_CLASS = cn(
	DESKTOP_TYPOGRAPHY.meta,
	'text-(--desktop-text-secondary)'
);

export const NH_QUICK_SETTINGS_CONTROL_LABEL_CENTER_CLASS = cn(
	'text-center',
	DESKTOP_TYPOGRAPHY.meta,
	'text-(--desktop-text-secondary)'
);

export const NH_QUICK_SETTINGS_INLINE_HINT_CLASS = cn(
	'mt-2 leading-snug',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_QUICK_SETTINGS_THEME_RAIL_CLASS =
	'mt-2 flex flex-wrap items-center gap-1 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-1';

export const NH_QUICK_SETTINGS_ACTION_ROW_CLASS = 'mt-2 flex flex-wrap gap-2';

export const NH_QUICK_SETTINGS_SOURCE_LIST_CLASS = 'mt-2 space-y-2';

export const NH_QUICK_SETTINGS_SOURCE_SOUND_ROW_CLASS =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-2.5';

export const NH_QUICK_SETTINGS_SOURCE_SOUND_GRID_CLASS =
	'grid gap-2 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:items-start';

export const NH_QUICK_SETTINGS_SOURCE_SOUND_HEAD_CLASS =
	'flex items-center justify-between gap-2 md:flex-col md:items-start md:justify-start';

export const NH_QUICK_SETTINGS_SOURCE_STATUS_CLASS = cn(
	'text-(--desktop-text-muted)',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

export const NH_QUICK_SETTINGS_TEST_LEAD_ROW_CLASS = 'flex items-start gap-2';

export const NH_QUICK_SETTINGS_TEST_INNER_CLASS = 'min-w-0 flex-1 space-y-2';

export function nhQuickSettingsTestIconClass(): string {
	return cn(
		DESKTOP_LUCIDE.md,
		'mt-0.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.85)]'
	);
}

export const NH_QUICK_SETTINGS_DND_TEST_HINT_CLASS = cn(
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_92%,rgb(var(--desktop-accent-rgb))_8%)] px-2 py-1.5 leading-snug',
	DESKTOP_TYPOGRAPHY.shellMeta10
);

/** Maps extension registry slot ids to wrapper spacing classes in NotificationHubBody. */
export function nhExtensionSlotClass(
	slot: NotificationHubExtensionSlot
): string {
	const map: Record<NotificationHubExtensionSlot, string> = {
		hubPanelFooter: NH_EXT_PANEL_FOOTER_CLASS,
		hubSettingsBefore: NH_EXT_SETTINGS_CLASS,
		hubSettingsAfter: NH_EXT_SETTINGS_AFTER_CLASS,
		hubFeedStart: NH_EXT_FEED_CLASS,
		hubFeedEnd: NH_EXT_FEED_END_CLASS,
	};
	return map[slot];
}

/** Filter reset button in empty states (window + panel). */
export const NH_FILTER_RESET_BUTTON_CLASS = 'min-w-[8rem]';

/** Filter / group-by chip buttons (panel type chips, window group mode). */
export function nhFilterChipButtonClass(): string {
	return cn('px-2 py-1', DESKTOP_TYPOGRAPHY.captionInherit);
}

export function nhSourceChipAllButtonClass(): string {
	return cn('max-w-full truncate px-2 py-1', DESKTOP_TYPOGRAPHY.captionInherit);
}

export function nhSourceChipButtonClass(): string {
	return cn(
		'max-w-[min(100%,14rem)] truncate px-2 py-1',
		DESKTOP_TYPOGRAPHY.captionInherit
	);
}

export function nhMarkGroupReadButtonClass(shrink = false): string {
	return cn(
		DESKTOP_TYPOGRAPHY.meta,
		shrink ? 'shrink-0 px-2 py-1' : 'px-2 py-1',
		'hover:text-(--desktop-text-primary)'
	);
}

export function nhToolbarButtonClass(typographyClass: string): string {
	return cn('min-w-0 flex-1', typographyClass);
}

export function nhItemTitleClass(compact: boolean): string {
	return compact
		? DESKTOP_TYPOGRAPHY.widgetTrackTitle
		: cn(
				'truncate font-semibold text-(--desktop-text-primary) antialiased',
				'text-sm'
			);
}

export function nhItemMessageClass(compact: boolean): string {
	return cn(
		'mt-1 leading-snug text-(--desktop-text-secondary)',
		compact
			? cn('line-clamp-2', DESKTOP_TYPOGRAPHY.captionInherit)
			: cn('line-clamp-3', DESKTOP_TYPOGRAPHY.meta)
	);
}

/** Primary/secondary server action chips on a notification row. */
export function nhItemServerActionButtonClass(compact: boolean): string {
	return compact ? DESKTOP_TYPOGRAPHY.captionInherit : DESKTOP_TYPOGRAPHY.meta;
}

export function nhItemUnreadDotClass(compact: boolean): string {
	return cn(
		'absolute rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.9)] shadow-[0_0_6px_rgb(var(--desktop-accent-rgb)/0.22)]',
		compact ? 'right-1.5 top-1.5 h-1 w-1' : 'right-2 top-2 h-1.5 w-1.5'
	);
}

export function nhItemSourceMetaRowClass(): string {
	return cn('mt-0.5 flex items-center gap-1', DESKTOP_TYPOGRAPHY.shellMeta10);
}

export function nhItemSourceBadgeClass(badgeTone: string): string {
	return cn(
		'px-1.5 py-0.5 uppercase tracking-[0.16em]',
		badgeTone,
		DESKTOP_TYPOGRAPHY.micro
	);
}

export function nhItemPinnedBadgeClass(): string {
	return cn(
		'border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-1.5 py-0.5',
		DESKTOP_TYPOGRAPHY.micro
	);
}

export function nhItemCompactMetaClass(): string {
	return cn(
		'mt-0.5 truncate text-(--desktop-text-muted)',
		DESKTOP_TYPOGRAPHY.shellMeta10
	);
}

export function nhItemDismissButtonClass(compact: boolean): string {
	return cn(
		'shrink-0 text-(--desktop-text-muted) hover:text-(--desktop-text-primary)',
		compact ? 'h-6 w-6' : 'h-7 w-7'
	);
}

export function nhItemCardShellClass(
	compact: boolean,
	typeBg: string,
	typeBorder: string,
	sourceContainerTone: string,
	unread: boolean
): string {
	return cn(
		'relative cursor-pointer border',
		compact
			? 'rounded-(--desktop-radius) p-2'
			: 'rounded-(--desktop-radius-lg) p-3',
		typeBg,
		sourceContainerTone,
		typeBorder,
		unread ? 'ring-1 ring-(--desktop-border-subtle)' : 'opacity-[0.9]',
		'transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none',
		'hover:shadow-lg hover:shadow-black/18'
	);
}

export function nhItemContentRowClass(compact: boolean): string {
	return cn('flex', compact ? 'gap-2' : 'gap-3');
}

export function nhItemIconWellShellClass(
	compact: boolean,
	iconWellBg: string,
	iconTone: string
): string {
	return cn(
		'flex shrink-0 items-center justify-center rounded-(--desktop-radius) border border-(--desktop-border-subtle) shadow-(--desktop-shadow-soft) [&_svg]:stroke-[1.35]',
		iconWellBg,
		iconTone,
		compact ? 'h-7 w-7' : 'h-9 w-9'
	);
}

/** Virtual list scroll containers and row spacing (panel vs window density). */
export const NH_PANEL_VIRTUAL_SCROLL_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2';

export const NH_WINDOW_VIRTUAL_SCROLL_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-contain';

export const NH_VIRTUAL_ROW_ABS_CLASS = 'absolute left-0 top-0 w-full';

export const NH_VIRTUAL_ITEM_GAP_PANEL_CLASS = 'pb-2';

export const NH_VIRTUAL_ITEM_GAP_WINDOW_CLASS = 'pb-3';

export const NH_PANEL_ANIMATED_LIST_CLASS =
	'min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3';

/** Initial row height hints for TanStack virtualizer `estimateSize`. */
export const NH_PANEL_VIRTUAL_ESTIMATE_PX = 100;

export const NH_WINDOW_VIRTUAL_ESTIMATE_PX = 128;

/** Extension slot wrappers in NotificationHubBody. */
export const NH_EXT_PANEL_FOOTER_CLASS = 'mt-2 space-y-2';

export const NH_EXT_SETTINGS_CLASS = 'space-y-3';

export const NH_EXT_SETTINGS_AFTER_CLASS = 'mt-3 space-y-3';

export const NH_EXT_FEED_CLASS = 'space-y-3';

export const NH_EXT_FEED_END_CLASS = 'space-y-3 pt-1';

/** Clear-all confirmation modal (alertdialog). */
export const NH_CLEAR_CONFIRM_MODAL_CLASS = 'max-w-md';

export const NH_CLEAR_CONFIRM_BODY_WRAP_CLASS = 'flex flex-col gap-4 p-4';

export const NH_CLEAR_CONFIRM_BODY_TEXT_CLASS = cn(
	'leading-relaxed text-(--desktop-text-secondary)',
	DESKTOP_TYPOGRAPHY.body
);

export const NH_CLEAR_CONFIRM_ACTIONS_CLASS =
	'flex flex-wrap justify-end gap-2';

export function nhItemServerActionsRowClass(compact: boolean): string {
	return cn('mt-2 flex flex-wrap gap-1.5', compact && 'mt-1 gap-1');
}

export function nhItemLegacyActionButtonClass(compact: boolean): string {
	return cn(
		'h-auto px-0 py-0 font-medium text-(--desktop-text-muted) hover:bg-transparent hover:text-(--desktop-text-primary)',
		compact
			? cn('mt-1', DESKTOP_TYPOGRAPHY.captionInherit)
			: cn('mt-2', DESKTOP_TYPOGRAPHY.meta)
	);
}

export function nhItemMetaFooterClass(compact: boolean): string {
	return cn(
		'flex items-center justify-between',
		DESKTOP_TYPOGRAPHY.caption,
		compact ? 'mt-1' : 'mt-2'
	);
}

export const NH_ITEM_NEW_BADGE_CLASS =
	'border-[rgb(var(--desktop-accent-rgb)/0.2)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-(--desktop-text-secondary)';

export function nhItemSecondaryServerActionClass(): string {
	return 'h-auto px-2 py-1 font-medium text-(--desktop-text-muted) hover:text-(--desktop-text-primary)';
}
