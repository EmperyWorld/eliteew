/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-section event to open admin Users catalog from command palette.
 */

export const ADMIN_USERS_OPEN_EVENT = 'eliteew-admin-users-open';

export type AdminUsersOpenDetail = {
	/** Optional catalog search string; omit when opening by userId only. */
	search?: string;
	userId?: string;
};

export function dispatchAdminUsersOpen(detail: AdminUsersOpenDetail): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<AdminUsersOpenDetail>(ADMIN_USERS_OPEN_EVENT, { detail })
	);
}
