/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P14 lock — shell restricted-app registry and access resolve (allowed/loading/denied).
 *
 * Invariants:
 * - Unlisted apps always allowed; UnifiedAdminApp requires UGS admin when auth settled.
 *
 * Related:
 * - `../desktopRestrictedAppAccess.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	desktopAppRequiresUgsAdmin,
	resolveDesktopRestrictedAppAccess,
} from '../desktopRestrictedAppAccess';

vi.mock('@/services/authSession', () => ({
	getUserInfo: vi.fn(() => null),
}));

describe('desktopRestrictedAppAccess', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('marks only registered apps as UGS-admin required', () => {
		expect(desktopAppRequiresUgsAdmin('UnifiedAdminApp')).toBe(true);
		expect(desktopAppRequiresUgsAdmin('AppStore')).toBe(false);
		expect(desktopAppRequiresUgsAdmin(null)).toBe(false);
	});

	it('allows unrestricted apps without auth', () => {
		expect(
			resolveDesktopRestrictedAppAccess({
				appComponent: 'AppStore',
				isAuthenticated: false,
				loading: false,
			})
		).toBe('allowed');
	});

	it('returns loading while auth is settling for restricted apps', () => {
		expect(
			resolveDesktopRestrictedAppAccess({
				appComponent: 'UnifiedAdminApp',
				isAuthenticated: false,
				loading: true,
			})
		).toBe('loading');
	});

	it('denies restricted apps when authenticated without admin role', () => {
		expect(
			resolveDesktopRestrictedAppAccess({
				appComponent: 'UnifiedAdminApp',
				user: { role: 'member', email: 'user@example.test' },
				isAuthenticated: true,
				loading: false,
			})
		).toBe('denied');
	});

	it('allows restricted apps for admin role when authenticated', () => {
		expect(
			resolveDesktopRestrictedAppAccess({
				appComponent: 'UnifiedAdminApp',
				user: { role: 'admin', email: 'admin@example.test' },
				isAuthenticated: true,
				loading: false,
			})
		).toBe('allowed');
	});
});
