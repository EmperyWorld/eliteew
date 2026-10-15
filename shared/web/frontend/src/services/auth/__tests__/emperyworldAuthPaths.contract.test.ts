/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for MobileAndroid `/api/auth/refresh` path (not SPA OIDC).
 *
 * Invariants:
 * - Refresh stays on `/api/auth/refresh` (no `/api/v1` mirror).
 * - SPA BaseService must not write/read emperyworld_* tokens for refresh.
 *
 * Related:
 * - documentation/product/FRONTEND-AUTH.md
 * - documentation/api/FRONTEND-BACKEND-HTTP.md
 * - shared/api/domains/auth.py
 */
import { describe, expect, it } from 'vitest';
import { MOBILE_AUTH_REFRESH_URL } from '../mobileAuthRefreshPath';

describe('Mobile auth refresh path contract', () => {
	it('refresh is Mobile-only mount (no /api/v1 mirror)', () => {
		expect(MOBILE_AUTH_REFRESH_URL).toBe('/api/auth/refresh');
	});

	it('path is not a SPA password-login or exchange-token endpoint', () => {
		expect(MOBILE_AUTH_REFRESH_URL).not.toContain('login');
		expect(MOBILE_AUTH_REFRESH_URL).not.toContain('exchange');
	});
});
