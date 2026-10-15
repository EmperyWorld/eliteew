/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin user detail panel tab ids and URL normalization.
 *
 * Invariants:
 * - Default tab is `overview`; only non-default tabs are serialized to URL.
 *
 * Related:
 * - `pages/Admin/AdminUserDetailPanel.tsx`
 * - `pages/Admin/adminUsersUrlFilters.ts`
 */

export type AdminUserDetailTab =
	| 'overview'
	| 'store'
	| 'ugs'
	| 'sessions'
	| 'ebrowser';

export const ADMIN_USER_DETAIL_TABS: ReadonlyArray<{ id: AdminUserDetailTab }> =
	[
		{ id: 'overview' },
		{ id: 'store' },
		{ id: 'ugs' },
		{ id: 'sessions' },
		{ id: 'ebrowser' },
	] as const;

const VALID_TABS = new Set<string>(ADMIN_USER_DETAIL_TABS.map((t) => t.id));

export function normalizeAdminUserDetailTab(
	raw: string | null | undefined
): AdminUserDetailTab {
	const v = raw?.trim();
	if (v && VALID_TABS.has(v)) return v as AdminUserDetailTab;
	return 'overview';
}

export function adminUserDetailTabToUrlParam(
	tab: AdminUserDetailTab
): string | null {
	return tab === 'overview' ? null : tab;
}
