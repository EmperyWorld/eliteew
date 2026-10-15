/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 0 lock — off-viewport chrome must fail the reachability intersection rule.
 *
 * Related:
 * - useDesktopInViewportReachability.ts
 * - shell/shellSemanticContracts.ts
 */

import { describe, expect, it } from 'vitest';
import { desktopChromeIntersectsViewport } from '../useDesktopInViewportReachability';

describe('desktopChromeIntersectsViewport (Wave 0 reachability)', () => {
	const vp = { width: 390, height: 700 };

	it('rejects fully above the viewport (legacy welcome y=-148 class)', () => {
		expect(
			desktopChromeIntersectsViewport(
				{ top: -148, bottom: -20, left: 40, right: 350 },
				vp
			)
		).toBe(false);
	});

	it('accepts banner seated above the taskbar', () => {
		expect(
			desktopChromeIntersectsViewport(
				{ top: 520, bottom: 640, left: 40, right: 350 },
				vp
			)
		).toBe(true);
	});

	it('rejects fully below the viewport', () => {
		expect(
			desktopChromeIntersectsViewport(
				{ top: 720, bottom: 800, left: 0, right: 200 },
				vp
			)
		).toBe(false);
	});
});
