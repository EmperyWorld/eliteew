/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users CSV column visibility and localized headers.
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
	buildAdminUsersCsvRows,
	getAdminUsersCsvColumnKeys,
} from '../adminUsersCsvExport';
import { adminUsersCsvHeaderLabelI18n } from '../adminUsersCsvHeaderI18n';
import { adminUserRoleLabelI18n } from '../adminUserRolesI18n';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';
import { COMPACT_ADMIN_USERS_TABLE_COLUMNS } from '../adminUsersTableColumns';

const sample: AdminDirectoryUserRow = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	username: 'u1',
	email: 'u1@test.local',
	role: 'admin',
	is_active: true,
	is_verified: false,
	is_trusted: false,
	created_at: '2026-01-01T00:00:00Z',
	login_count: 1,
	ugs_credits: 10,
	ew_balance: 100,
	presence_online: true,
	presence_sessions: 1,
};

describe('adminUsersCsvExport', () => {
	it('omits email in compact column preset', () => {
		const keys = getAdminUsersCsvColumnKeys(COMPACT_ADMIN_USERS_TABLE_COLUMNS);
		expect(keys).not.toContain('email');
		expect(keys).toContain('username');
	});

	it('includes email when column visible', () => {
		const keys = getAdminUsersCsvColumnKeys({
			email: true,
			created_at: true,
			last_login_at: true,
			socket_activity: true,
			shop_group: true,
			flags: true,
		});
		expect(keys.indexOf('email')).toBe(1);
	});

	it('uses roleLabel callback for role column', () => {
		const t = ((key: string) =>
			key === 'adminUsersHub.roles.admin' ? 'Админ RU' : key) as TFunction;
		const { columnKeys, rows } = buildAdminUsersCsvRows(
			[sample],
			COMPACT_ADMIN_USERS_TABLE_COLUMNS,
			{
				roleLabel: (role) => adminUserRoleLabelI18n(role, t),
			}
		);
		const roleIdx = columnKeys.indexOf('role');
		expect(rows[0][roleIdx]).toBe('Админ RU');
	});

	it('uses headerLabel for localized CSV headers', () => {
		const t = ((key: string) =>
			key === 'adminUsersHub.csvHeaders.role' ? 'Роль RU' : key) as TFunction;
		const { header } = buildAdminUsersCsvRows(
			[sample],
			COMPACT_ADMIN_USERS_TABLE_COLUMNS,
			{
				headerLabel: (key) => adminUsersCsvHeaderLabelI18n(key, t),
			}
		);
		expect(header).toContain('Роль RU');
	});
});
