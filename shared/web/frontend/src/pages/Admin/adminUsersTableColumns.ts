/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional column visibility for admin Users hub directory table (localStorage presets).
 *
 * Invariants:
 * - Checkbox, user, role, channels, and EW/UGS columns are always shown.
 * - First visit (no saved preset) uses compact column preset.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 */

export type AdminUsersTableColumnId =
	| 'email'
	| 'created_at'
	| 'last_login_at'
	| 'socket_activity'
	| 'shop_group'
	| 'flags';

export type AdminUsersTableColumns = Record<AdminUsersTableColumnId, boolean>;

/** Toggleable column ids (for filters panel and equality checks). */
export const ADMIN_USERS_TOGGLEABLE_COLUMN_IDS: readonly AdminUsersTableColumnId[] =
	[
		'email',
		'created_at',
		'last_login_at',
		'socket_activity',
		'shop_group',
		'flags',
	] as const;

/** English fallbacks for tests/scripts only; UI uses `adminUsersHub.columns.*` via `t()`. */
export const ADMIN_USERS_TABLE_COLUMN_LABELS: Record<
	AdminUsersTableColumnId,
	string
> = {
	email: 'Email',
	created_at: 'Registered',
	last_login_at: 'Last login',
	socket_activity: 'Socket (last)',
	shop_group: 'App store group',
	flags: 'Flags',
};

export const ADMIN_USERS_TABLE_COLUMNS_KEY = 'eliteew.admin.users.tableColumns';

/** Always-visible data columns (not toggled). */
export const ADMIN_USERS_TABLE_FIXED_COLUMN_COUNT = 5;

export const DEFAULT_ADMIN_USERS_TABLE_COLUMNS: AdminUsersTableColumns = {
	email: true,
	created_at: true,
	last_login_at: true,
	socket_activity: true,
	shop_group: true,
	flags: true,
};

export const COMPACT_ADMIN_USERS_TABLE_COLUMNS: AdminUsersTableColumns = {
	email: false,
	created_at: false,
	last_login_at: false,
	socket_activity: false,
	shop_group: true,
	flags: false,
};

export function countVisibleTableColumns(cols: AdminUsersTableColumns): number {
	let n = ADMIN_USERS_TABLE_FIXED_COLUMN_COUNT;
	for (const id of Object.keys(cols) as AdminUsersTableColumnId[]) {
		if (cols[id]) n += 1;
	}
	return n;
}

export function normalizeAdminUsersTableColumns(
	raw: Partial<AdminUsersTableColumns> | null | undefined
): AdminUsersTableColumns {
	const base = { ...DEFAULT_ADMIN_USERS_TABLE_COLUMNS };
	if (!raw || typeof raw !== 'object') return base;
	for (const id of Object.keys(base) as AdminUsersTableColumnId[]) {
		if (typeof raw[id] === 'boolean') base[id] = raw[id];
	}
	return base;
}

export function loadAdminUsersTableColumns(): AdminUsersTableColumns {
	if (typeof window === 'undefined')
		return { ...COMPACT_ADMIN_USERS_TABLE_COLUMNS };
	try {
		const raw = localStorage.getItem(ADMIN_USERS_TABLE_COLUMNS_KEY);
		if (!raw) return { ...COMPACT_ADMIN_USERS_TABLE_COLUMNS };
		return normalizeAdminUsersTableColumns(
			JSON.parse(raw) as Partial<AdminUsersTableColumns>
		);
	} catch {
		return { ...COMPACT_ADMIN_USERS_TABLE_COLUMNS };
	}
}

export function tableColumnsEqual(
	a: AdminUsersTableColumns,
	b: AdminUsersTableColumns
): boolean {
	for (const id of ADMIN_USERS_TOGGLEABLE_COLUMN_IDS) {
		if (a[id] !== b[id]) return false;
	}
	return true;
}

export function toggleAdminUsersTableColumn(
	cols: AdminUsersTableColumns,
	id: AdminUsersTableColumnId
): AdminUsersTableColumns {
	return { ...cols, [id]: !cols[id] };
}

export function saveAdminUsersTableColumns(cols: AdminUsersTableColumns): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(ADMIN_USERS_TABLE_COLUMNS_KEY, JSON.stringify(cols));
	} catch {
		/* ignore */
	}
}
