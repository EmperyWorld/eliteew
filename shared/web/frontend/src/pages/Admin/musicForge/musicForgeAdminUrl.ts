/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=musicForge&musicForgeTab=` for MusicForge Admin hub sub-tabs.
 *
 * Invariants:
 * - musicForgeTab is cleared when leaving the musicForge section.
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgeAdminSection.tsx`
 */

import type { MusicForgeAdminTab } from './musicForgeAdminApi';

const VALID_TABS: ReadonlySet<MusicForgeAdminTab> = new Set([
	'overview',
	'runs',
	'feedback',
	'config',
	'probe',
]);

export function isMusicForgeAdminTab(
	value: string
): value is MusicForgeAdminTab {
	return VALID_TABS.has(value as MusicForgeAdminTab);
}

export function readMusicForgeAdminTabFromUrl(
	search?: string
): MusicForgeAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('musicForgeTab');
		if (tab && isMusicForgeAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncMusicForgeAdminTabToUrl(
	tab: MusicForgeAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'musicForge') {
			return;
		}
		url.searchParams.set('musicForgeTab', tab);
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
