/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users hub role label mapping (member DB alias).
 *
 * Invariants:
 * - `brotherhood_member` and `emperyworld_member` share the same display label.
 *
 * Related:
 * - `pages/Admin/adminUserRoles.ts`
 */

import { describe, expect, it } from 'vitest';
import { adminUserRoleLabel, shortenAdminUserId } from '../adminUserRoles';

describe('adminUserRoles', () => {
	it('maps brotherhood_member to Member (English fallback)', () => {
		expect(adminUserRoleLabel('brotherhood_member')).toBe('Member');
		expect(adminUserRoleLabel('emperyworld_member')).toBe('Member');
	});

	it('shortens long user ids for table display', () => {
		const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
		expect(shortenAdminUserId(id)).toMatch(/^a1b2c3d4…7890$/);
	});
});
