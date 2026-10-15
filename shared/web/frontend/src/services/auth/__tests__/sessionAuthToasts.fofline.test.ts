/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock: FoFline displace toast picks honest XOR copy (W3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({
	warning: vi.fn(),
	info: vi.fn(),
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('../sessionAuthI18n', () => ({
	tSessionAuth: (key: string) => `sessionAuth.${key}`,
}));

describe('sessionAuthToasts FoFline displace', () => {
	beforeEach(() => {
		toast.warning.mockClear();
	});

	it('uses FoFline / browser specific copy when displaced_by is set', async () => {
		const { showSessionReplacedToast, resetSessionAuthToastStateForTests } =
			await import('../sessionAuthToasts');
		resetSessionAuthToastStateForTests();
		showSessionReplacedToast('fofline');
		expect(toast.warning).toHaveBeenCalledWith(
			'sessionAuth.sessionReplacedByFofline'
		);
		showSessionReplacedToast('browser');
		expect(toast.warning).toHaveBeenCalledWith(
			'sessionAuth.sessionReplacedByBrowser'
		);
		showSessionReplacedToast();
		expect(toast.warning).toHaveBeenCalledWith('sessionAuth.sessionReplaced');
	});
});
