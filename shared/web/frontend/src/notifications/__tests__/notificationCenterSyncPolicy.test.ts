/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock reconnect refetch and dismiss PUT flush for the notification-center inbox.
 *
 * Invariants:
 * - Any socket restore, including initial connect, refetches GET.
 * - Any pending dismiss skips the 900 ms PUT debounce.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
 */

import { describe, expect, it } from 'vitest';
import {
	NOTIFICATION_CENTER_PUT_DEBOUNCE_MS,
	notificationCenterPutDebounceMs,
	shouldRefetchInboxOnConnectionRestored,
} from '../notificationCenterSyncPolicy';

describe('notification center sync policy', () => {
	it('refetches inbox on every connection-restored, including initial connect', () => {
		expect(shouldRefetchInboxOnConnectionRestored({ initial: true })).toBe(
			true
		);
		expect(shouldRefetchInboxOnConnectionRestored({ initial: false })).toBe(
			true
		);
		expect(shouldRefetchInboxOnConnectionRestored({})).toBe(true);
		expect(shouldRefetchInboxOnConnectionRestored(undefined)).toBe(true);
	});

	it('flushes PUT immediately when dismiss tombstones are pending', () => {
		expect(notificationCenterPutDebounceMs(1)).toBe(0);
		expect(notificationCenterPutDebounceMs(0)).toBe(
			NOTIFICATION_CENTER_PUT_DEBOUNCE_MS
		);
	});
});
