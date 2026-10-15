/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=kbsew&kbsewTab=` for KBSEW Admin hub sub-tabs.
 */

import type { KbsewAdminTab } from '../kbsewAdminApi';

const VALID_TABS: ReadonlySet<KbsewAdminTab> = new Set([
	'overview',
	'barrels',
	'agent-access',
	'test-search',
]);

export function isKbsewAdminTab(value: string): value is KbsewAdminTab {
	return VALID_TABS.has(value as KbsewAdminTab);
}

export function readKbsewAdminTabFromUrl(
	search?: string
): KbsewAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('kbsewTab');
		if (tab && isKbsewAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncKbsewAdminTabToUrl(
	tab: KbsewAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'kbsew') {
			return;
		}
		url.searchParams.set('kbsewTab', tab);
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
