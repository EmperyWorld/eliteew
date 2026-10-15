/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Users hub sub-views: directory catalog vs live Socket.IO online list.
 *
 * Invariants:
 * - Default view is `catalog`; only `online` is serialized to URL.
 *
 * Related:
 * - `pages/Admin/adminUsersUrlFilters.ts`
 * - `pages/Admin/AdminUsersHubSection.tsx`
 */

export type AdminUsersHubView = 'catalog' | 'online';

export function normalizeAdminUsersHubView(
	raw: string | null | undefined
): AdminUsersHubView {
	return raw === 'online' ? 'online' : 'catalog';
}

export function adminUsersHubViewToUrlParam(
	view: AdminUsersHubView
): string | null {
	return view === 'online' ? 'online' : null;
}
