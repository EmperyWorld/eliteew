/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for frontend UGS Admin access visibility.
 *
 * Invariants:
 * - UI role grants must mirror backend `require_ugs_admin_user`.
 * - Keycloak realm-management style roles are not EliteEW app-admin grants.
 *
 * Related:
 * - src/utils/ugsAdminAccess.ts
 * - shared/api/services/ugs/admin_access.py
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/authSession', () => ({
	getUserInfo: () => null,
}));

import {
	hasUgsAdminIdentity,
	mapTokenRolesToUserRole,
	rolesIncludeEmperyworldAdmin,
	rolesIncludeUgsAdminAccess,
} from '../ugsAdminAccess';

describe('ugsAdminAccess', () => {
	it('accepts only backend-aligned app admin roles', () => {
		expect(rolesIncludeUgsAdminAccess(['admin'])).toBe(true);
		expect(rolesIncludeUgsAdminAccess(['emperyworld_admin'])).toBe(true);
		expect(rolesIncludeUgsAdminAccess(['msi'])).toBe(true);
		expect(rolesIncludeUgsAdminAccess(['realm-admin'])).toBe(false);
		expect(rolesIncludeUgsAdminAccess(['eliteew-admin'])).toBe(false);
		expect(rolesIncludeUgsAdminAccess(['superadmin'])).toBe(false);
	});

	it('maps token roles without collapsing emperyworld_admin', () => {
		expect(mapTokenRolesToUserRole(['emperyworld_admin'])).toBe(
			'emperyworld_admin'
		);
		expect(mapTokenRolesToUserRole(['admin', 'emperyworld_admin'])).toBe(
			'emperyworld_admin'
		);
		expect(mapTokenRolesToUserRole(['msi'])).toBe('admin');
		expect(mapTokenRolesToUserRole(['admin'])).toBe('admin');
		expect(mapTokenRolesToUserRole([])).toBe('emperyworld_member');
		expect(rolesIncludeEmperyworldAdmin(['admin'])).toBe(false);
		expect(rolesIncludeEmperyworldAdmin(['emperyworld_admin'])).toBe(true);
	});

	it('does not grant UI access from email alone (API break-glass only)', () => {
		expect(
			hasUgsAdminIdentity({ role: 'member', email: 'keysray70@gmail.com' })
		).toBe(false);
		expect(
			hasUgsAdminIdentity({ role: 'member', email: 'user@example.test' })
		).toBe(false);
		expect(
			hasUgsAdminIdentity({ role: 'admin', email: 'user@example.test' })
		).toBe(true);
	});
});
