/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=search&searchTab=` for Search Admin hub sub-tabs.
 *
 * Invariants:
 * - searchTab is cleared when leaving the search section.
 *
 * Related:
 * - `pages/Admin/search/SearchAdminSection.tsx`
 */

import type { SearchAdminTab } from '../adminSearchApi';

const VALID_TABS: ReadonlySet<SearchAdminTab> = new Set([
	'overview',
	'settings',
	'surfaces',
	'test',
	'diagnostics',
	'audit',
	'quota',
	'stats',
]);

export function isSearchAdminTab(value: string): value is SearchAdminTab {
	return VALID_TABS.has(value as SearchAdminTab);
}

export function readSearchAdminTabFromUrl(
	search?: string
): SearchAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('searchTab');
		if (tab && isSearchAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncSearchAdminTabToUrl(
	tab: SearchAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'search') {
			return;
		}
		url.searchParams.set('searchTab', tab);
		const next = `${url.pathname}${url.search}${url.hash}`;
		if (
			`${window.location.pathname}${window.location.search}${window.location.hash}` !==
			next
		) {
			window.history.replaceState(null, '', next);
		}
	} catch {
		/* ignore */
	}
}

export function clearSearchAdminTabFromUrl(opts?: { enabled?: boolean }): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('searchTab')) {
			return;
		}
		url.searchParams.delete('searchTab');
		const next = `${url.pathname}${url.search}${url.hash}`;
		window.history.replaceState(null, '', next);
	} catch {
		/* ignore */
	}
}
