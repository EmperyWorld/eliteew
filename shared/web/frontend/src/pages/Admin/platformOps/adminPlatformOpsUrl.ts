/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=platformOps&platformOpsTab=` for Platform Ops Admin tabs.
 *
 * Invariants:
 * - platformOpsTab is cleared when leaving the section (adminShellUrl).
 *
 * Related:
 * - `pages/Admin/platformOps/PlatformOpsAdminSection.tsx`
 */

import type { PlatformOpsAdminTab } from './platformOpsApi';

const VALID_TABS: ReadonlySet<PlatformOpsAdminTab> = new Set([
	'stack0',
	'egress',
	'portalPeers',
]);

export function isPlatformOpsAdminTab(
	value: string
): value is PlatformOpsAdminTab {
	return VALID_TABS.has(value as PlatformOpsAdminTab);
}

export function readPlatformOpsAdminTabFromUrl(
	search?: string
): PlatformOpsAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('platformOpsTab');
		if (tab && isPlatformOpsAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncPlatformOpsAdminTabToUrl(
	tab: PlatformOpsAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'platformOps') {
			return;
		}
		url.searchParams.set('platformOpsTab', tab);
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
