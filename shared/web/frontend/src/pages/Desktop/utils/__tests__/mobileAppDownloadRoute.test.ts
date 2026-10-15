/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensure mobile-app-download hash stays a full-page route (not coerced to desktop).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { coercePageToDesktopShell } from '../desktopOnlyNavigation';
import { resolveInitialPage } from '@/utils/pageRouting';

describe('mobile-app-download routing', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/');
	});

	afterEach(() => {
		window.history.replaceState(null, '', '/');
	});

	it('does not coerce mobile-app-download to desktop', () => {
		const { page, pending } = coercePageToDesktopShell(
			'mobile-app-download',
			'mobile-app-download'
		);
		expect(page).toBe('mobile-app-download');
		expect(pending).toBeNull();
	});

	it('resolveInitialPage keeps #/mobile-app-download', () => {
		window.history.replaceState(null, '', '#/mobile-app-download');
		expect(resolveInitialPage()).toBe('mobile-app-download');
	});
});
