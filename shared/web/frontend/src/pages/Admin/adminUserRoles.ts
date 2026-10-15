/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared role labels and directory filter values for the admin Users hub (UI + API query).
 *
 * Invariants:
 * - Filter value `emperyworld_member` is sent to the API; backend matches `brotherhood_member` in Postgres.
 * - Display labels map legacy `brotherhood_member` to the same member label as `emperyworld_member`.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `api/routers/desktop_admin.py` (`admin_users_directory`)
 */

/** Postgres role strings stored for default members (SSO persist path). */
export const MEMBER_ROLE_DB_VALUES = [
	'emperyworld_member',
	'brotherhood_member',
] as const;

/** Values shown in the role filter dropdown (API expands member alias). */
export const ADMIN_DIRECTORY_ROLE_FILTER_VALUES = [
	'admin',
	'emperyworld_admin',
	'emperyworld_member',
	'moderator',
	'ai_agent',
] as const;

/** English fallbacks when `TFunction` is unavailable (CSV export default, tests). */
export const ADMIN_USER_ROLE_LABELS_EN: Record<string, string> = {
	admin: 'Admin',
	emperyworld_admin: 'Empery World admin',
	emperyworld_member: 'Member',
	brotherhood_member: 'Member',
	moderator: 'Moderator',
	ai_agent: 'AI agent',
};

/** @deprecated Prefer `adminUserRoleLabelI18n` with `useTranslation`. */
export function adminUserRoleLabel(role: string | null | undefined): string {
	if (!role) return '—';
	return ADMIN_USER_ROLE_LABELS_EN[role] ?? role;
}

export function shortenAdminUserId(id: string): string {
	const t = id.trim();
	if (t.length <= 14) return t;
	return `${t.slice(0, 8)}…${t.slice(-4)}`;
}
