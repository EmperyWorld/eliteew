/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for i18n role labels in admin Users hub.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';

const t = ((key: string) =>
	(
		({
			'adminUsersHub.roles.member': 'Member',
			'adminUsersHub.roles.admin': 'Admin',
		}) as Record<string, string>
	)[key] ?? key) as TFunction;

describe('adminUserRoleLabelI18n', () => {
	it('maps known roles via i18n keys', () => {
		expect(adminUserRoleLabelI18n('brotherhood_member', t)).toBe('Member');
		expect(adminUserRoleLabelI18n('emperyworld_member', t)).toBe('Member');
		expect(adminUserRoleLabelI18n('admin', t)).toBe('Admin');
	});

	it('falls back to raw role string', () => {
		expect(adminUserRoleLabelI18n('custom_role', t)).toBe('custom_role');
	});
});
