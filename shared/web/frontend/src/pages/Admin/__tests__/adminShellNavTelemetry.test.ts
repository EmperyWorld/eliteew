/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock in-session admin shell section-select counters (independent of log level).
 *
 * Related:
 * - pages/Admin/shell/adminShellNavTelemetry.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	getAdminShellNavTelemetrySnapshot,
	recordAdminShellSectionSelect,
	resetAdminShellNavTelemetryForTests,
} from '../shell/adminShellNavTelemetry';

afterEach(() => {
	resetAdminShellNavTelemetryForTests();
});

describe('adminShellNavTelemetry', () => {
	it('increments per section and total', () => {
		expect(recordAdminShellSectionSelect('users', { embedded: false })).toBe(1);
		expect(recordAdminShellSectionSelect('users', { embedded: true })).toBe(2);
		expect(recordAdminShellSectionSelect('workers')).toBe(1);

		const snap = getAdminShellNavTelemetrySnapshot();
		expect(snap.totalSelects).toBe(3);
		expect(snap.bySection.users).toBe(2);
		expect(snap.bySection.workers).toBe(1);
	});

	it('reset clears snapshot for test isolation', () => {
		recordAdminShellSectionSelect('system');
		resetAdminShellNavTelemetryForTests();
		expect(getAdminShellNavTelemetrySnapshot()).toEqual({
			totalSelects: 0,
			bySection: {},
		});
	});
});
