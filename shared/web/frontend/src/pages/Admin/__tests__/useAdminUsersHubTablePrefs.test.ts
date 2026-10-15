/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Users hub table prefs localStorage keys after split from filters hook.
 *
 * Related:
 * - pages/Admin/users/useAdminUsersHubTablePrefs.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAdminUsersHubTablePrefs } from '../users/useAdminUsersHubTablePrefs';

const CHANNELS_KEY = 'eliteew.admin.users.channelsCompact';
const AUTO_REFRESH_KEY = 'eliteew.admin.users.autoRefresh';

afterEach(() => {
	localStorage.removeItem(CHANNELS_KEY);
	localStorage.removeItem(AUTO_REFRESH_KEY);
});

describe('useAdminUsersHubTablePrefs', () => {
	it('persists channelsCompact and autoRefresh to localStorage', () => {
		const { result } = renderHook(() => useAdminUsersHubTablePrefs());

		act(() => {
			result.current.setChannelsCompact(false);
			result.current.setAutoRefresh(true);
		});

		expect(localStorage.getItem(CHANNELS_KEY)).toBe('false');
		expect(localStorage.getItem(AUTO_REFRESH_KEY)).toBe('true');
		expect(result.current.tableColSpan).toBeGreaterThan(0);
	});
});
