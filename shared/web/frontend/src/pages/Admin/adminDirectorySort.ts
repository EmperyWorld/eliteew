/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sort options for admin Users directory (aligned with API sort_by / sort_dir).
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `api/routers/desktop_admin.py`
 */

export type AdminDirectorySortBy =
	| 'created_at'
	| 'last_login_at'
	| 'username'
	| 'email'
	| 'ew_balance';

export type AdminDirectorySortDir = 'asc' | 'desc';

export const ADMIN_DIRECTORY_SORT_OPTIONS = [
	{
		value: 'created_at:desc',
		label: 'Registered · newest',
		sort_by: 'created_at',
		sort_dir: 'desc',
	},
	{
		value: 'created_at:asc',
		label: 'Registered · oldest',
		sort_by: 'created_at',
		sort_dir: 'asc',
	},
	{
		value: 'last_login_at:desc',
		label: 'Last login · recent',
		sort_by: 'last_login_at',
		sort_dir: 'desc',
	},
	{
		value: 'last_login_at:asc',
		label: 'Last login · oldest',
		sort_by: 'last_login_at',
		sort_dir: 'asc',
	},
	{
		value: 'username:asc',
		label: 'Username A–Z',
		sort_by: 'username',
		sort_dir: 'asc',
	},
	{ value: 'email:asc', label: 'Email A–Z', sort_by: 'email', sort_dir: 'asc' },
	{
		value: 'ew_balance:desc',
		label: 'EW · highest',
		sort_by: 'ew_balance',
		sort_dir: 'desc',
	},
	{
		value: 'ew_balance:asc',
		label: 'EW · lowest',
		sort_by: 'ew_balance',
		sort_dir: 'asc',
	},
] as const satisfies ReadonlyArray<{
	value: `${AdminDirectorySortBy}:${AdminDirectorySortDir}`;
	label: string;
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
}>;

export type AdminDirectorySortOptionValue =
	(typeof ADMIN_DIRECTORY_SORT_OPTIONS)[number]['value'];

/** i18n keys under `adminUsersHub.sort.*` aligned with `ADMIN_DIRECTORY_SORT_OPTIONS` values. */
export const ADMIN_DIRECTORY_SORT_I18N: Record<
	AdminDirectorySortOptionValue,
	string
> = {
	'created_at:desc': 'adminUsersHub.sort.createdDesc',
	'created_at:asc': 'adminUsersHub.sort.createdAsc',
	'last_login_at:desc': 'adminUsersHub.sort.loginDesc',
	'last_login_at:asc': 'adminUsersHub.sort.loginAsc',
	'username:asc': 'adminUsersHub.sort.usernameAsc',
	'email:asc': 'adminUsersHub.sort.emailAsc',
	'ew_balance:desc': 'adminUsersHub.sort.ewDesc',
	'ew_balance:asc': 'adminUsersHub.sort.ewAsc',
};

export function parseAdminDirectorySortValue(value: string): {
	sort_by: AdminDirectorySortBy;
	sort_dir: AdminDirectorySortDir;
} {
	const hit = ADMIN_DIRECTORY_SORT_OPTIONS.find((o) => o.value === value);
	if (hit) return { sort_by: hit.sort_by, sort_dir: hit.sort_dir };
	const [rawBy, rawDir] = value.split(':');
	const sort_by = (
		['created_at', 'last_login_at', 'username', 'email', 'ew_balance'] as const
	).includes(rawBy as AdminDirectorySortBy)
		? (rawBy as AdminDirectorySortBy)
		: 'created_at';
	const sort_dir: AdminDirectorySortDir = rawDir === 'asc' ? 'asc' : 'desc';
	return { sort_by, sort_dir };
}

/** Toggle sort when operator clicks a column header. */
export function toggleDirectoryColumnSort(
	sortKey: AdminDirectorySortBy,
	current: { sort_by: AdminDirectorySortBy; sort_dir: AdminDirectorySortDir }
): `${AdminDirectorySortBy}:${AdminDirectorySortDir}` {
	if (current.sort_by === sortKey) {
		const nextDir: AdminDirectorySortDir =
			current.sort_dir === 'asc' ? 'desc' : 'asc';
		return `${sortKey}:${nextDir}`;
	}
	return `${sortKey}:desc`;
}
