/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Poemma DEV role-switcher visibility to owner / platform admin.
 *
 * Invariants:
 * - Team members never get canChangePoemmaRoleOnServer true via platform user role alone.
 *
 * Related:
 * - poemmaRoleChangeAcl.ts
 */

import { describe, expect, it } from 'vitest';
import { canChangePoemmaRoleOnServer } from '../poemmaRoleChangeAcl';

describe('canChangePoemmaRoleOnServer', () => {
	it('allows poemma owner', () => {
		expect(
			canChangePoemmaRoleOnServer({
				poemmaRole: 'owner',
				platformRole: 'user',
			})
		).toBe(true);
	});

	it('denies team without platform admin', () => {
		expect(
			canChangePoemmaRoleOnServer({
				poemmaRole: 'team',
				platformRole: 'user',
			})
		).toBe(false);
	});

	it('allows platform admin even when poemma role is team', () => {
		expect(
			canChangePoemmaRoleOnServer({
				poemmaRole: 'team',
				platformRole: 'emperyworld_admin',
			})
		).toBe(true);
		expect(
			canChangePoemmaRoleOnServer({
				poemmaRole: 'manager',
				platformRole: 'admin',
			})
		).toBe(true);
	});
});
