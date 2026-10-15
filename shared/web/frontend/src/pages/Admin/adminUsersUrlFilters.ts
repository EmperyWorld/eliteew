/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Serialize admin Users directory filters to URL query (shareable links with section=users).
 *
 * Invariants:
 * - Preserves unrelated query keys (e.g. other admin sections) only when syncing managed keys.
 * - `userId` in URL opens detail panel; if `q` empty, search is prefilled with userId for lookup.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - `pages/Admin/adminUsersFilterPresets.ts`
 */

import { parseAdminDirectorySortValue } from './adminDirectorySort';
import {
	normalizeAdminUsersHubView,
	type AdminUsersHubView,
} from './adminUsersHubView';
import {
	normalizeAdminUserDetailTab,
	type AdminUserDetailTab,
} from './adminUsersDetailTab';
import {
	DEFAULT_ADMIN_USERS_FILTERS,
	normalizeAdminUsersFilterSnapshot,
	type AdminUsersFilterSnapshot,
	type AdminUsersTriFilter,
} from './adminUsersFilterPresets';

const MANAGED_PARAMS = [
	'q',
	'role',
	'active',
	'trusted',
	'verified',
	'online',
	'group',
	'anomaly',
	'ssoBrowser',
	'ssoMobile',
	'sort',
	'page',
	'userId',
	'userTab',
	'view',
	'mismatch',
] as const;

export type AdminUsersUrlHydration = {
	filters: AdminUsersFilterSnapshot;
	page: number;
	userId: string | null;
	userTab: AdminUserDetailTab;
	view: AdminUsersHubView;
	fromUrl: boolean;
};

function triFromParam(v: string | null): AdminUsersTriFilter {
	if (v === 'yes' || v === 'no') return v;
	return 'all';
}

function hasManagedUrlParams(sp: URLSearchParams): boolean {
	return MANAGED_PARAMS.some((k) => {
		const val = sp.get(k);
		return val != null && val !== '';
	});
}

export function parseAdminUsersUrl(
	search: URLSearchParams
): AdminUsersUrlHydration | null {
	if (!hasManagedUrlParams(search)) return null;

	const userId = search.get('userId')?.trim() || null;
	let q = search.get('q')?.trim() ?? '';
	if (!q && userId) q = userId;

	const pageRaw = Number.parseInt(search.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	const filters = normalizeAdminUsersFilterSnapshot({
		search: q,
		roleFilter: search.get('role')?.trim() ?? '',
		activeFilter: triFromParam(search.get('active')),
		trustedFilter: triFromParam(search.get('trusted')),
		verifiedFilter: triFromParam(search.get('verified')),
		onlineOnly: search.get('online') === '1',
		groupFilter: search.get('group')?.trim() ?? '',
		anomalyOnly: search.get('anomaly') === '1',
		ssoBrowserOnly: search.get('ssoBrowser') === '1',
		ssoMobileOnly: search.get('ssoMobile') === '1',
		ssoDesktopOnly: search.get('ssoDesktop') === '1',
		mismatchOnly: search.get('mismatch') === '1',
		sortValue:
			search.get('sort')?.trim() || DEFAULT_ADMIN_USERS_FILTERS.sortValue,
	});

	parseAdminDirectorySortValue(filters.sortValue);

	const view = normalizeAdminUsersHubView(search.get('view'));
	const userTab = normalizeAdminUserDetailTab(search.get('userTab'));

	return {
		filters,
		page,
		userId,
		view,
		userTab,
		fromUrl: true,
	};
}

export function buildAdminUsersSearchParams(
	filters: AdminUsersFilterSnapshot,
	opts?: {
		page?: number;
		userId?: string | null;
		section?: string;
		view?: AdminUsersHubView;
		userTab?: AdminUserDetailTab | null;
	}
): URLSearchParams {
	const s = normalizeAdminUsersFilterSnapshot(filters);
	const sp = new URLSearchParams();
	sp.set('section', opts?.section ?? 'users');
	if (s.search.trim()) sp.set('q', s.search.trim());
	if (s.roleFilter.trim()) sp.set('role', s.roleFilter.trim());
	if (s.activeFilter !== 'all') sp.set('active', s.activeFilter);
	if (s.trustedFilter !== 'all') sp.set('trusted', s.trustedFilter);
	if (s.verifiedFilter !== 'all') sp.set('verified', s.verifiedFilter);
	if (s.onlineOnly) sp.set('online', '1');
	if (s.groupFilter.trim()) sp.set('group', s.groupFilter.trim());
	if (s.anomalyOnly) sp.set('anomaly', '1');
	if (s.ssoBrowserOnly) sp.set('ssoBrowser', '1');
	if (s.ssoMobileOnly) sp.set('ssoMobile', '1');
	if (s.ssoDesktopOnly) sp.set('ssoDesktop', '1');
	if (s.sortValue !== DEFAULT_ADMIN_USERS_FILTERS.sortValue) {
		sp.set('sort', s.sortValue);
	}
	const page = opts?.page ?? 1;
	if (page > 1) sp.set('page', String(page));
	const uid = opts?.userId?.trim();
	if (uid) sp.set('userId', uid);
	if (opts?.view === 'online') sp.set('view', 'online');
	const tab = opts?.userTab;
	if (tab && tab !== 'overview') sp.set('userTab', tab);
	if (s.mismatchOnly) sp.set('mismatch', '1');
	return sp;
}

export function replaceAdminUsersUrl(
	filters: AdminUsersFilterSnapshot,
	opts?: {
		page?: number;
		userId?: string | null;
		view?: AdminUsersHubView;
		userTab?: AdminUserDetailTab | null;
	}
): void {
	if (typeof window === 'undefined') return;
	try {
		const url = new URL(window.location.href);
		for (const key of MANAGED_PARAMS) url.searchParams.delete(key);
		const built = buildAdminUsersSearchParams(filters, opts);
		for (const [key, value] of built.entries()) {
			url.searchParams.set(key, value);
		}
		if (!url.searchParams.has('section')) {
			url.searchParams.set('section', 'users');
		}
		window.history.replaceState(null, '', url.toString());
	} catch {
		/* ignore */
	}
}
