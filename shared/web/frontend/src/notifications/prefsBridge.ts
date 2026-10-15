/**
 * Snapshot of profile notification preferences for non-React callers (notify API, socket hook).
 * Updated by UserPreferencesAppProvider when preferences load or clear.
 */

import type { NotificationPreferences } from '../types/profile';
import type { NotificationType } from './types';

let snapshot: NotificationPreferences | null = null;

export function setNotificationPreferencesSnapshot(
	prefs: NotificationPreferences | null
): void {
	snapshot = prefs;
}

export function getNotificationPreferencesSnapshot(): NotificationPreferences | null {
	return snapshot;
}

/** When `in_app` is false, suppress in-app toasts/center except errors. */
export function shouldDeliverInAppForType(type: NotificationType): boolean {
	if (snapshot?.in_app !== false) return true;
	return type === 'error';
}
