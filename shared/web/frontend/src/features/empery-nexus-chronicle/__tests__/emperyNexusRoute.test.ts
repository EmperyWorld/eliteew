/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensure `#/empery-nexus` remains a fullscreen shell route (not desktop-coerced).
 *
 * Invariants:
 * - VALID_PAGES + SYSTEM_FULL_PAGE_ROUTES both include empery-nexus.
 *
 * Related:
 * - utils/pageRouting.ts
 * - pages/Desktop/utils/desktopOnlyLegacyRoutes.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { coercePageToDesktopShell } from '@/pages/Desktop/utils/desktopOnlyNavigation';
import { SYSTEM_FULL_PAGE_ROUTES } from '@/pages/Desktop/utils/desktopOnlyLegacyRoutes';
import {
	normalizePageCandidate,
	resolveInitialPage,
} from '@/utils/pageRouting';

describe('empery-nexus routing', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/');
	});

	afterEach(() => {
		window.history.replaceState(null, '', '/');
	});

	it('is a system full-page route', () => {
		expect(SYSTEM_FULL_PAGE_ROUTES.has('empery-nexus')).toBe(true);
	});

	it('normalizes chronicle alias to empery-nexus', () => {
		expect(normalizePageCandidate('#/empery-nexus-chronicle')).toBe(
			'empery-nexus'
		);
		expect(normalizePageCandidate('#/empery-nexus')).toBe('empery-nexus');
	});

	it('does not coerce empery-nexus to desktop', () => {
		const { page, pending } = coercePageToDesktopShell(
			'empery-nexus',
			'empery-nexus'
		);
		expect(page).toBe('empery-nexus');
		expect(pending).toBeNull();
	});

	it('resolves initial page from hash', () => {
		window.history.replaceState(null, '', '/#/empery-nexus');
		expect(resolveInitialPage()).toBe('empery-nexus');
	});
});
