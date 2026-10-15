/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMaintenanceStatus } from '@/services/maintenance/maintenanceState';
import {
	bootstrapReloadCircuitFromUrl,
	getRecentAutoReloadCount,
	isManualReloadReason,
	isReloadBudgetExceeded,
	isReloadHoldActive,
	recordAutoReload,
	resetReloadCircuitForTests,
	shouldBlockAutoReload,
} from '@/services/maintenance/reloadCircuitBreaker';

describe('reloadCircuitBreaker', () => {
	afterEach(() => {
		resetReloadCircuitForTests();
		clearMaintenanceStatus();
		vi.unstubAllGlobals();
	});

	it('records auto reload reasons from URL bootstrap', () => {
		const href =
			'https://app.eliteew.ru/?_eliteew_reload=1&_eliteew_reason=chunk_load_failure#/desktop';
		vi.stubGlobal('location', { ...window.location, href });
		vi.stubGlobal('history', {
			...window.history,
			replaceState: vi.fn(),
			state: null,
		});

		bootstrapReloadCircuitFromUrl();

		expect(getRecentAutoReloadCount()).toBe(1);
		expect(isReloadBudgetExceeded()).toBe(false);
	});

	it('enters hold after two automatic reload landings', () => {
		recordAutoReload('client_stale_socket');
		recordAutoReload('maintenance_completed');
		expect(isReloadBudgetExceeded()).toBe(true);
		expect(shouldBlockAutoReload('deploy_version_changed')).toBe(true);
	});

	it('allows manual reload reasons through the hold budget', () => {
		recordAutoReload('chunk_load_failure');
		recordAutoReload('bundle_build_mismatch');
		expect(isReloadBudgetExceeded()).toBe(true);
		expect(isManualReloadReason('manual_user')).toBe(true);
		expect(shouldBlockAutoReload('manual_user')).toBe(false);
	});

	it('tracks hold flag in sessionStorage', () => {
		recordAutoReload('a');
		recordAutoReload('b');
		expect(isReloadHoldActive()).toBe(true);
	});
});
