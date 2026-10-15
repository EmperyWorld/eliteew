/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 4 locks for full-shell-only chrome SSOT + mobile embedded journey map.
 *
 * Related:
 * - ../desktopFullShellChrome.ts
 * - ../mobileEmbeddedSpaRoute.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_CHROME_FULL_SHELL_ONLY,
	desktopFullShellOnlyChromeProps,
	shouldRenderFullShellOnlyChrome,
} from '../desktopFullShellChrome';
import {
	MOBILE_EMBEDDED_JOURNEY_MAP,
	listMobileEmbeddedHashRoutes,
} from '../mobileEmbeddedSpaRoute';

describe('desktopFullShellChrome', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('exports stable full-shell-only data attribute', () => {
		expect(DESKTOP_CHROME_FULL_SHELL_ONLY).toBe('full-shell-only');
		expect(desktopFullShellOnlyChromeProps()).toEqual({
			'data-desktop-chrome': 'full-shell-only',
		});
	});

	it('hides chrome when embeddedMobileLayout is true', () => {
		expect(shouldRenderFullShellOnlyChrome(true)).toBe(false);
		expect(shouldRenderFullShellOnlyChrome(false)).toBe(true);
	});

	it('detects mobile embedded hash routes when layout flag omitted', () => {
		vi.stubGlobal('window', {
			location: { hash: '#/mobile-desktop-settings' },
		});
		expect(shouldRenderFullShellOnlyChrome()).toBe(false);
		vi.stubGlobal('window', {
			location: { hash: '#/desktop' },
		});
		expect(shouldRenderFullShellOnlyChrome()).toBe(true);
	});
});

describe('MOBILE_EMBEDDED_JOURNEY_MAP', () => {
	it('covers every allowlisted hash route and always hides full shell chrome', () => {
		const routes = listMobileEmbeddedHashRoutes();
		expect(MOBILE_EMBEDDED_JOURNEY_MAP).toHaveLength(routes.length);
		for (const route of routes) {
			const row = MOBILE_EMBEDDED_JOURNEY_MAP.find((j) => j.route === route);
			expect(row, `missing journey for ${route}`).toBeDefined();
			expect(row?.hidesFullShellChrome).toBe(true);
			expect(row?.journey.length).toBeGreaterThan(0);
		}
	});
});
