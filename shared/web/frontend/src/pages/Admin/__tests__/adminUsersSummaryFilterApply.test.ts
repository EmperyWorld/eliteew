/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock mutually exclusive Users hub summary filter apply helpers.
 *
 * Related:
 * - pages/Admin/users/adminUsersSummaryFilterApply.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	applySummaryMismatchFilter,
	applySummaryOnlineFilter,
	type AdminUsersSummaryFilterSetters,
} from '../users/adminUsersSummaryFilterApply';

function makeSetters(): AdminUsersSummaryFilterSetters & {
	flags: Record<string, boolean>;
	page: number;
} {
	const flags = {
		online: false,
		anomaly: false,
		ssoBrowser: false,
		ssoMobile: false,
		ssoDesktop: false,
		mismatch: false,
	};
	let page = 3;
	return {
		flags,
		get page() {
			return page;
		},
		setOnlineOnly: (v) => {
			flags.online = v;
		},
		setAnomalyOnly: (v) => {
			flags.anomaly = v;
		},
		setSsoBrowserOnly: (v) => {
			flags.ssoBrowser = v;
		},
		setSsoMobileOnly: (v) => {
			flags.ssoMobile = v;
		},
		setSsoDesktopOnly: (v) => {
			flags.ssoDesktop = v;
		},
		setMismatchOnly: (v) => {
			flags.mismatch = v;
		},
		setPage: (updater) => {
			page = typeof updater === 'function' ? updater(page) : updater;
		},
	};
}

describe('adminUsersSummaryFilterApply', () => {
	it('online apply clears siblings and resets page', () => {
		const s = makeSetters();
		s.setAnomalyOnly(true);
		applySummaryOnlineFilter(s);
		expect(s.flags.online).toBe(true);
		expect(s.flags.anomaly).toBe(false);
		expect(s.page).toBe(1);
	});

	it('mismatch apply clears online', () => {
		const s = makeSetters();
		s.setOnlineOnly(true);
		applySummaryMismatchFilter(s);
		expect(s.flags.mismatch).toBe(true);
		expect(s.flags.online).toBe(false);
		expect(s.page).toBe(1);
	});

	it('setPage accepts numeric updater', () => {
		const setPage = vi.fn();
		const s: AdminUsersSummaryFilterSetters = {
			setOnlineOnly: vi.fn(),
			setAnomalyOnly: vi.fn(),
			setSsoBrowserOnly: vi.fn(),
			setSsoMobileOnly: vi.fn(),
			setSsoDesktopOnly: vi.fn(),
			setMismatchOnly: vi.fn(),
			setPage,
		};
		applySummaryOnlineFilter(s);
		expect(setPage).toHaveBeenCalledWith(1);
	});
});
