/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Localized CSV column headers for admin Users directory export.
 *
 * Related:
 * - `pages/Admin/adminUsersCsvExport.ts`
 * - `desktopUi.adminUsersHub.csvHeaders.*`
 */

import type { TFunction } from 'i18next';

export type AdminUsersCsvColumnKey =
	| 'id'
	| 'username'
	| 'email'
	| 'full_name'
	| 'role'
	| 'is_active'
	| 'is_verified'
	| 'is_trusted'
	| 'ew_balance'
	| 'ugs_credits'
	| 'presence_online'
	| 'presence_sessions_web'
	| 'presence_sessions_mobile'
	| 'sso_browser_active'
	| 'sso_mobile_active'
	| 'app_access_group'
	| 'created_at'
	| 'last_login_at';

const CSV_HEADER_I18N: Record<AdminUsersCsvColumnKey, string> = {
	id: 'adminUsersHub.csvHeaders.id',
	username: 'adminUsersHub.csvHeaders.username',
	email: 'adminUsersHub.csvHeaders.email',
	full_name: 'adminUsersHub.csvHeaders.full_name',
	role: 'adminUsersHub.csvHeaders.role',
	is_active: 'adminUsersHub.csvHeaders.is_active',
	is_verified: 'adminUsersHub.csvHeaders.is_verified',
	is_trusted: 'adminUsersHub.csvHeaders.is_trusted',
	ew_balance: 'adminUsersHub.csvHeaders.ew_balance',
	ugs_credits: 'adminUsersHub.csvHeaders.ugs_credits',
	presence_online: 'adminUsersHub.csvHeaders.presence_online',
	presence_sessions_web: 'adminUsersHub.csvHeaders.presence_sessions_web',
	presence_sessions_mobile: 'adminUsersHub.csvHeaders.presence_sessions_mobile',
	sso_browser_active: 'adminUsersHub.csvHeaders.sso_browser_active',
	sso_mobile_active: 'adminUsersHub.csvHeaders.sso_mobile_active',
	app_access_group: 'adminUsersHub.csvHeaders.app_access_group',
	created_at: 'adminUsersHub.csvHeaders.created_at',
	last_login_at: 'adminUsersHub.csvHeaders.last_login_at',
};

/** English fallbacks when `t` is unavailable (tests, scripts). */
export const ADMIN_USERS_CSV_HEADERS_EN: Record<
	AdminUsersCsvColumnKey,
	string
> = {
	id: 'id',
	username: 'username',
	email: 'email',
	full_name: 'full_name',
	role: 'role',
	is_active: 'is_active',
	is_verified: 'is_verified',
	is_trusted: 'is_trusted',
	ew_balance: 'ew_balance',
	ugs_credits: 'ugs_credits',
	presence_online: 'presence_online',
	presence_sessions_web: 'presence_sessions_web',
	presence_sessions_mobile: 'presence_sessions_mobile',
	sso_browser_active: 'sso_browser_active',
	sso_mobile_active: 'sso_mobile_active',
	app_access_group: 'app_access_group',
	created_at: 'created_at',
	last_login_at: 'last_login_at',
};

export function adminUsersCsvHeaderLabelI18n(
	key: AdminUsersCsvColumnKey,
	t: TFunction
): string {
	return t(CSV_HEADER_I18N[key]);
}
