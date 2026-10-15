/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=workers&workersTab=` for Workers Admin hub sub-tabs.
 *
 * Invariants:
 * - workersTab is cleared when leaving the workers section (adminShellUrl).
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

import type { WorkersAdminTab } from './workersOpsApi';

const VALID_TABS: ReadonlySet<WorkersAdminTab> = new Set([
	'overview',
	'celery',
	'beat',
	'rabbitmq',
	'actions',
]);

export function isWorkersAdminTab(value: string): value is WorkersAdminTab {
	return VALID_TABS.has(value as WorkersAdminTab);
}

export function readWorkersAdminTabFromUrl(
	search?: string
): WorkersAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const tab = new URLSearchParams(raw).get('workersTab');
		if (tab && isWorkersAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncWorkersAdminTabToUrl(
	tab: WorkersAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== 'workers') {
			return;
		}
		url.searchParams.set('workersTab', tab);
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
