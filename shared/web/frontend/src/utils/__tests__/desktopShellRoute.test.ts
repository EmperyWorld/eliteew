/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for runtime Desktop route checks shared with boot policy.
 *
 * Invariants:
 * - Empty and slash-prefixed Desktop hashes match the default Desktop route.
 *
 * Related:
 * - `utils/desktopShellRoute.ts`
 */

import { describe, expect, it } from 'vitest';
import { isDesktopShellRoute } from '@/utils/desktopShellRoute';

describe('isDesktopShellRoute', () => {
	it('matches desktop root and store deep links', () => {
		for (const hash of [
			'',
			'#desktop',
			'#/desktop',
			'#desktop/store',
			'#desktop/store/foo',
		]) {
			window.location.hash = hash;
			expect(isDesktopShellRoute()).toBe(true);
		}
	});

	it('does not match other app pages', () => {
		window.location.hash = '#admin';
		expect(isDesktopShellRoute()).toBe(false);
	});
});
