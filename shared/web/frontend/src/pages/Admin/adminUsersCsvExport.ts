/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side CSV export for selected rows in admin Users directory.
 *
 * Invariants:
 * - Export uses only fields already visible in the directory table.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `pages/Admin/adminUsersCsvHeaderI18n.ts`
 */

import { adminUserRoleLabel } from './adminUserRoles';
import {
	ADMIN_USERS_CSV_HEADERS_EN,
	type AdminUsersCsvColumnKey,
} from './adminUsersCsvHeaderI18n';

export type { AdminUsersCsvColumnKey } from './adminUsersCsvHeaderI18n';
import type { AdminDirectoryUserRow } from './adminDirectoryUserTypes';
import {
	DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
	type AdminUsersTableColumns,
} from './adminUsersTableColumns';
import { escapeCsvCell } from '../../utils/csvEscapeField';

export type BuildAdminUsersCsvOptions = {
	/** Localized role labels; defaults to English `adminUserRoleLabel`. */
	roleLabel?: (role: string | null | undefined) => string;
	/** Localized header labels; defaults to English technical keys. */
	headerLabel?: (key: AdminUsersCsvColumnKey) => string;
};

/** Column order for export (stable ids for tests and i18n). */
export function getAdminUsersCsvColumnKeys(
	tableColumns: AdminUsersTableColumns = DEFAULT_ADMIN_USERS_TABLE_COLUMNS
): AdminUsersCsvColumnKey[] {
	const keys: AdminUsersCsvColumnKey[] = [
		'id',
		'username',
		'full_name',
		'role',
		'is_active',
		'is_verified',
		'is_trusted',
		'ew_balance',
		'ugs_credits',
		'presence_online',
		'presence_sessions_web',
		'presence_sessions_mobile',
		'sso_browser_active',
		'sso_mobile_active',
	];
	if (tableColumns.email) {
		keys.splice(1, 0, 'email');
	}
	if (tableColumns.shop_group) {
		keys.push('app_access_group');
	}
	if (tableColumns.created_at) {
		keys.push('created_at');
	}
	if (tableColumns.last_login_at) {
		keys.push('last_login_at');
	}
	return keys;
}

function rowValueForColumn(
	u: AdminDirectoryUserRow,
	key: AdminUsersCsvColumnKey,
	roleLabel: (role: string | null | undefined) => string
): string | number | boolean {
	switch (key) {
		case 'id':
			return u.id;
		case 'username':
			return u.username;
		case 'email':
			return u.email;
		case 'full_name':
			return u.full_name ?? '';
		case 'role':
			return roleLabel(u.role);
		case 'is_active':
			return u.is_active;
		case 'is_verified':
			return u.is_verified;
		case 'is_trusted':
			return u.is_trusted;
		case 'ew_balance':
			return u.ew_balance;
		case 'ugs_credits':
			return u.ugs_credits;
		case 'presence_online':
			return u.presence_online;
		case 'presence_sessions_web':
			return u.presence_sessions_web ?? 0;
		case 'presence_sessions_mobile':
			return u.presence_sessions_mobile ?? 0;
		case 'sso_browser_active':
			return u.sso_browser_active ?? false;
		case 'sso_mobile_active':
			return u.sso_mobile_active ?? false;
		case 'app_access_group':
			return u.app_access_group_name ?? '';
		case 'created_at':
			return u.created_at;
		case 'last_login_at':
			return u.last_login_at ?? '';
		default: {
			const _exhaustive: never = key;
			return _exhaustive;
		}
	}
}

export type AdminUsersCsvExportOptions = {
	filename?: string;
	/** When set, optional directory columns follow table visibility. */
	tableColumns?: AdminUsersTableColumns | null;
	/** Localized role labels; defaults to English `adminUserRoleLabel`. */
	roleLabel?: (role: string | null | undefined) => string;
	/** Localized CSV header labels. */
	headerLabel?: (key: AdminUsersCsvColumnKey) => string;
};

export function buildAdminUsersCsvRows(
	users: AdminDirectoryUserRow[],
	tableColumns: AdminUsersTableColumns = DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
	opts?: BuildAdminUsersCsvOptions
): {
	columnKeys: AdminUsersCsvColumnKey[];
	header: string[];
	rows: string[][];
} {
	const roleLabel = opts?.roleLabel ?? adminUserRoleLabel;
	const headerLabel =
		opts?.headerLabel ?? ((k) => ADMIN_USERS_CSV_HEADERS_EN[k]);
	const columnKeys = getAdminUsersCsvColumnKeys(tableColumns);
	const header = columnKeys.map(headerLabel);
	const rows = users.map((u) =>
		columnKeys.map((key) => escapeCsvCell(rowValueForColumn(u, key, roleLabel)))
	);
	return { columnKeys, header, rows };
}

export function downloadAdminUsersCsv(
	users: AdminDirectoryUserRow[],
	opts?: AdminUsersCsvExportOptions | string
): void {
	const options: AdminUsersCsvExportOptions =
		typeof opts === 'string' ? { filename: opts } : (opts ?? {});
	const cols = options.tableColumns ?? DEFAULT_ADMIN_USERS_TABLE_COLUMNS;
	const { header, rows } = buildAdminUsersCsvRows(users, cols, {
		roleLabel: options.roleLabel,
		headerLabel: options.headerLabel,
	});
	const body = [header.join(','), ...rows.map((cells) => cells.join(','))].join(
		'\n'
	);
	const filename = options.filename ?? 'eliteew-users.csv';
	const blob = new Blob([`\uFEFF${body}`], {
		type: 'text/csv;charset=utf-8',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
