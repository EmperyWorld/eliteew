/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for O2 updater CTA honesty (install only when update_available).
 */

import { describe, expect, it } from 'vitest';

/** Mirrors App.tsx rule: install CTA only for update_available. */
function canShowInstallCta(code: string, availableVersion?: string | null): boolean {
	return code === 'update_available' && Boolean(availableVersion);
}

/** Mirrors UpdaterStatus dual-flag: restart wins over install. */
function resolveUpdaterStripState(
	canInstall: boolean,
	canRestart: boolean
): 'idle' | 'available' | 'restart' {
	if (canRestart) return 'restart';
	if (canInstall) return 'available';
	return 'idle';
}

describe('desktop-client updater CTA O2', () => {
	it('hides install for fail-closed and up-to-date codes', () => {
		for (const code of [
			'not_configured',
			'signing_required',
			'offline_skip',
			'up_to_date',
			'check_failed',
		]) {
			expect(canShowInstallCta(code, '0.3.0')).toBe(false);
		}
	});

	it('shows install only when update_available with version', () => {
		expect(canShowInstallCta('update_available', '0.3.0')).toBe(true);
		expect(canShowInstallCta('update_available', null)).toBe(false);
	});

	it('prefers restart over install when both flags are true', () => {
		expect(resolveUpdaterStripState(true, true)).toBe('restart');
		expect(resolveUpdaterStripState(true, false)).toBe('available');
		expect(resolveUpdaterStripState(false, false)).toBe('idle');
	});
});
