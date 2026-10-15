/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sync timing for the notification-center inbox: reconnect refetch and PUT debounce.
 *
 * Invariants:
 * - Any socket restore, including the initial connect, refetches GET so persist-on-emit
 *   rows are not served from a 120 s bootstrap seed.
 * - Dismiss tombstones flush PUT immediately; other inbox edits keep the 900 ms debounce.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
 */

export const NOTIFICATION_CENTER_PUT_DEBOUNCE_MS = 900;

export function shouldRefetchInboxOnConnectionRestored(
	_payload: unknown
): boolean {
	return true;
}

export function notificationCenterPutDebounceMs(
	dismissedCount: number
): number {
	return dismissedCount > 0 ? 0 : NOTIFICATION_CENTER_PUT_DEBOUNCE_MS;
}
