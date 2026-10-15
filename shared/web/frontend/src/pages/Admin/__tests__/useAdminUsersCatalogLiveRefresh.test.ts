/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for live presence directory refetch hook.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ADMIN_USERS_LIVE_PRESENCE_MS,
	useAdminUsersCatalogLiveRefresh,
} from '../users/useAdminUsersCatalogLiveRefresh';

describe('useAdminUsersCatalogLiveRefresh', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.defineProperty(document, 'visibilityState', {
			value: 'visible',
			configurable: true,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('refetches on interval when enabled', () => {
		const refetch = vi.fn().mockResolvedValue(undefined);
		renderHook(() =>
			useAdminUsersCatalogLiveRefresh(refetch, {
				enabled: true,
				skipWhenAutoRefresh: false,
			})
		);
		expect(refetch).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(ADMIN_USERS_LIVE_PRESENCE_MS);
		expect(refetch).toHaveBeenCalledTimes(2);
	});

	it('skips when auto-refresh already handles polling', () => {
		const refetch = vi.fn().mockResolvedValue(undefined);
		renderHook(() =>
			useAdminUsersCatalogLiveRefresh(refetch, {
				enabled: true,
				skipWhenAutoRefresh: true,
			})
		);
		expect(refetch).not.toHaveBeenCalled();
	});
});
