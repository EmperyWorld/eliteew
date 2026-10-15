/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { buildAdminUserDiagnosticReport } from '../adminUserDiagnosticReport';
import type { AdminDirectoryUserRow } from '../adminDirectoryUserTypes';

const t = ((key: string, params?: Record<string, string | number>) => {
	const map: Record<string, string> = {
		'adminDiagnosticReport.header': '=== EliteEW · user card (admin) ===',
		'adminDiagnosticReport.footer': '=== end ===',
		'adminDiagnosticReport.id': `ID: ${params?.value}`,
		'adminDiagnosticReport.email': `Email: ${params?.value}`,
		'adminDiagnosticReport.username': `Username: ${params?.value}`,
		'adminDiagnosticReport.name': `Name: ${params?.value}`,
		'adminDiagnosticReport.role': `Role: ${params?.label} (${params?.code})`,
		'adminDiagnosticReport.flags': 'flags',
		'adminDiagnosticReport.shopGroup': `group: ${params?.value}`,
		'adminDiagnosticReport.balances': `EW: ${params?.ew}`,
		'adminDiagnosticReport.registered': `reg: ${params?.value}`,
		'adminDiagnosticReport.lastLogin': `login: ${params?.value}`,
		'adminDiagnosticReport.channelsHeader': '--- Channels ---',
		'adminDiagnosticReport.socketIo': 'socket',
		'adminDiagnosticReport.ssoBrowser': 'sso web',
		'adminDiagnosticReport.ssoMobile': 'sso mob',
		'adminDiagnosticReport.summary': `Summary: ${params?.live}/${params?.total}${params?.anomaly ?? ''}`,
		'adminDiagnosticReport.anomaly': ' · ANOMALY: web Socket.IO > 1',
		'adminDiagnosticReport.anomalyNotKeycloak':
			' · Socket.IO web > 1; SSO Keycloak OK',
		'adminUsersHub.roles.member': 'Member',
		'adminDiagnosticReport.yes': 'yes',
		'adminDiagnosticReport.no': 'no',
		'adminDiagnosticReport.active': 'active',
		'adminDiagnosticReport.inactive': 'none',
		'adminDiagnosticReport.liveSuffix': '',
		'adminDiagnosticReport.ipSuffix': '',
	};
	return map[key] ?? key;
}) as TFunction<'desktopUi'>;

const baseUser: AdminDirectoryUserRow = {
	id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	username: 'poet',
	email: 'poet@test.eliteew.ru',
	role: 'brotherhood_member',
	full_name: 'Poet',
	is_active: true,
	is_verified: true,
	is_trusted: false,
	created_at: '2026-01-01T00:00:00Z',
	login_count: 1,
	ugs_credits: 10,
	ew_balance: 100,
	presence_online: true,
	presence_sessions: 2,
	presence_sessions_web: 2,
	presence_sessions_mobile: 0,
	sso_browser_active: true,
	sso_browser_live: true,
};

describe('buildAdminUserDiagnosticReport', () => {
	it('includes user id and anomaly hint for multi web socket', () => {
		const text = buildAdminUserDiagnosticReport(baseUser, t);
		expect(text).toContain(baseUser.id);
		expect(text).toContain('SSO Keycloak OK');
		expect(text).not.toContain('Bearer');
	});
});
