/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import axios from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { APIError } from '@/services/api/client';
import {
	clearMaintenanceStatus,
	getCurrentMaintenanceStatus,
	publishMaintenanceStatus,
} from '@/services/maintenance/maintenanceState';
import {
	publishUnplannedMaintenanceFromHttpError,
	resetUnplannedHttpErrorWindowForTests,
	shouldDedupeErrorToast,
	shouldSuppressApiErrorToast,
} from '@/services/maintenance/recoveryNotificationGuard';

describe('recoveryNotificationGuard', () => {
	afterEach(() => {
		clearMaintenanceStatus();
		resetUnplannedHttpErrorWindowForTests();
	});

	it('suppresses API error toasts during active maintenance', () => {
		publishMaintenanceStatus({
			active: true,
			window: {
				id: 'restart-1',
				phase: 'active',
				active: true,
				suppress_error_toasts: true,
			},
		});

		expect(
			shouldSuppressApiErrorToast(
				new APIError('Server error', 503, undefined, undefined, undefined)
			)
		).toBe(true);
	});

	it('suppresses upstream 502/503/504 even without maintenance overlay', () => {
		expect(
			shouldSuppressApiErrorToast(
				new APIError('Bad gateway', 502, undefined, undefined, undefined)
			)
		).toBe(true);
	});

	it('does not suppress ordinary 404 client errors', () => {
		expect(
			shouldSuppressApiErrorToast(
				new APIError('Not found', 404, undefined, undefined, undefined)
			)
		).toBe(false);
	});

	it('suppresses axios cancel and follower passive mode', () => {
		expect(
			shouldSuppressApiErrorToast(new axios.CanceledError('canceled'))
		).toBe(true);
		expect(
			shouldSuppressApiErrorToast(new Error('follower_tab_passive_mode'))
		).toBe(true);
	});

	it('requires repeated upstream errors before unplanned maintenance', () => {
		publishUnplannedMaintenanceFromHttpError(503, 45);
		expect(getCurrentMaintenanceStatus().active).toBe(false);
		publishUnplannedMaintenanceFromHttpError(503, 45);
		expect(getCurrentMaintenanceStatus().window?.id).toBe('unplanned-http-503');
		publishUnplannedMaintenanceFromHttpError(502, 30);
		expect(getCurrentMaintenanceStatus().window?.id).toBe('unplanned-http-503');
		clearMaintenanceStatus();
		resetUnplannedHttpErrorWindowForTests();
		publishUnplannedMaintenanceFromHttpError(502, 30);
		expect(getCurrentMaintenanceStatus().active).toBe(false);
		publishUnplannedMaintenanceFromHttpError(502, 30);
		expect(getCurrentMaintenanceStatus().window?.id).toBe('unplanned-http-502');
	});

	it('dedupes identical error toasts within the window', () => {
		expect(shouldDedupeErrorToast('Ошибка', 'Сеть недоступна')).toBe(false);
		expect(shouldDedupeErrorToast('Ошибка', 'Сеть недоступна')).toBe(true);
	});
});
