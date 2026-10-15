/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Notification Hub list filter active state and Escape reset guard.
 *
 * Invariants:
 * - Does not mutate React state; callers apply returned booleans in UI/effects.
 *
 * Related:
 * - NotificationHubBody.tsx
 */

import type { NotificationType } from '@/notifications';

export type NotificationHubReadFilter = 'all' | 'unread';

export type NotificationHubTypeChipFilter = 'all' | NotificationType;

export function notificationHubWindowFiltersActive(
	searchQuery: string,
	sourceFilter: string,
	readFilter: NotificationHubReadFilter
): boolean {
	return (
		searchQuery.trim().length > 0 ||
		sourceFilter !== 'all' ||
		readFilter === 'unread'
	);
}

export function notificationHubPanelFiltersActive(
	readFilter: NotificationHubReadFilter,
	typeChipFilter: NotificationHubTypeChipFilter
): boolean {
	return readFilter === 'unread' || typeChipFilter !== 'all';
}

/** Skip Escape reset while typing in search or other text fields. */
export function shouldResetNotificationHubFiltersOnEscape(
	target: EventTarget | null
): boolean {
	if (!(target instanceof HTMLElement)) return true;
	return !target.closest('input, textarea, [contenteditable="true"]');
}

export type NotificationHubEscapeAction =
	| 'reset-filters'
	| 'close-panel'
	| 'none';

/** Virtual window feed forces type grouping regardless of user preference. */
export function resolveNotificationHubEffectiveGroupMode(
	groupMode: 'type' | 'source',
	useWindowVirtual: boolean
): 'type' | 'source' {
	return useWindowVirtual ? 'type' : groupMode;
}

/** Resolve Escape in notification hub (panel flyout or full window). */
export function resolveNotificationHubEscapeAction(params: {
	filtersActive: boolean;
	density: 'panel' | 'window';
	hasRequestClose: boolean;
	target: EventTarget | null;
}): NotificationHubEscapeAction {
	if (!shouldResetNotificationHubFiltersOnEscape(params.target)) {
		return 'none';
	}
	if (params.filtersActive) return 'reset-filters';
	if (params.hasRequestClose) {
		return 'close-panel';
	}
	return 'none';
}
