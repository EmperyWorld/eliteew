/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=content&contentTab=` for Content Admin hub sub-tabs.
 *
 * Invariants:
 * - contentTab is cleared when leaving the content section.
 *
 * Related:
 * - `pages/Admin/content/ContentAdminSection.tsx`
 */

import type { ContentAdminTab } from '../contentAdminApi';

const VALID_TABS: ReadonlySet<ContentAdminTab> = new Set([
	'overview',
	'diagnostics',
	'quota',
	'processing-failures',
	'storage-ops',
]);

export function isContentAdminTab(value: string): value is ContentAdminTab {
	return VALID_TABS.has(value as ContentAdminTab);
}

export function readContentAdminTabFromUrl(
	search?: string
): ContentAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('contentTab');
		if (tab && isContentAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncContentAdminTabToUrl(
	tab: ContentAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'content') {
			return;
		}
		url.searchParams.set('contentTab', tab);
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

export function clearContentAdminTabFromUrl(opts?: {
	enabled?: boolean;
}): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('contentTab')) {
			return;
		}
		url.searchParams.delete('contentTab');
		const next = `${url.pathname}${url.search}${url.hash}`;
		window.history.replaceState(null, '', next);
	} catch {
		/* ignore */
	}
}
