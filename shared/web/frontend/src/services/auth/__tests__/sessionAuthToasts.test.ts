/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session auth toast helpers — i18n keys and debounce guard.
 *
 * Related:
 * - services/auth/sessionAuthToasts.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	resetSessionAuthToastStateForTests,
	showSessionExpiredRedirectToast,
	showSessionReplacedToast,
} from '../sessionAuthToasts';

vi.mock('sonner', () => ({
	toast: {
		warning: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock('@/i18n/config', () => ({
	default: {
		t: (key: string) => key,
	},
}));

describe('sessionAuthToasts', () => {
	afterEach(() => {
		resetSessionAuthToastStateForTests();
		vi.clearAllMocks();
	});

	it('shows session replaced toast via i18n key', async () => {
		const { toast } = await import('sonner');
		showSessionReplacedToast();
		expect(toast.warning).toHaveBeenCalledWith('sessionAuth.sessionReplaced');
	});

	it('debounces terminal redirect toast within window', async () => {
		const { toast } = await import('sonner');
		showSessionExpiredRedirectToast();
		showSessionExpiredRedirectToast();
		expect(toast.warning).toHaveBeenCalledTimes(1);
		expect(toast.warning).toHaveBeenCalledWith('sessionAuth.loginRedirecting');
	});
});
