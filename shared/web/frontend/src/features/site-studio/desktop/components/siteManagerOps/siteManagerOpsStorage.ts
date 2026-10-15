/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * sessionStorage helpers for Site Manager Ops selected site and control chrome.
 *
 * Invariants:
 * - Persistence is best-effort; failures fall back to defaults without throwing.
 * - Keys stay under eliteew.siteManagerOps.* namespace.
 *
 * Related:
 * - ./SiteManagerOpsPanel.tsx
 * - documentation/product/SITE-STUDIO.md
 */
import type { SiteManagerViewMode } from '../SiteManagerOpsAtoms';
import type {
	SiteManagerUxFilter,
	SiteManagerUxSort,
} from '../../siteManagerUserStatus';

export const selectedSiteStorageKey =
	'eliteew.siteManagerOps.selectedSiteKey.v1';
export const siteManagerControlsStorageKey =
	'eliteew.siteManagerOps.controls.v1';

export type SiteManagerStoredControls = {
	viewMode: SiteManagerViewMode;
	filter: SiteManagerUxFilter;
	searchQuery: string;
	sort: SiteManagerUxSort;
};

export const DEFAULT_SITE_MANAGER_CONTROLS: SiteManagerStoredControls = {
	viewMode: 'attention',
	filter: 'needs_attention',
	searchQuery: '',
	sort: 'attention',
};

export function readStoredSelectedSiteKey(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.sessionStorage.getItem(selectedSiteStorageKey);
	} catch {
		return null;
	}
}

export function persistSelectedSiteKey(siteKey: string | null): void {
	if (typeof window === 'undefined') return;
	try {
		if (siteKey) {
			window.sessionStorage.setItem(selectedSiteStorageKey, siteKey);
			return;
		}
		window.sessionStorage.removeItem(selectedSiteStorageKey);
	} catch {
		// Session persistence is best-effort; the panel still works without it.
	}
}

export function readStoredControls(): SiteManagerStoredControls {
	if (typeof window === 'undefined') return DEFAULT_SITE_MANAGER_CONTROLS;
	try {
		const raw = window.sessionStorage.getItem(siteManagerControlsStorageKey);
		if (!raw) return DEFAULT_SITE_MANAGER_CONTROLS;
		const parsed = JSON.parse(raw) as Partial<SiteManagerStoredControls>;
		const viewMode = parsed.viewMode;
		return {
			viewMode:
				viewMode === 'attention' ||
				viewMode === 'domains' ||
				viewMode === 'advanced'
					? viewMode
					: DEFAULT_SITE_MANAGER_CONTROLS.viewMode,
			filter: parsed.filter ?? DEFAULT_SITE_MANAGER_CONTROLS.filter,
			searchQuery:
				typeof parsed.searchQuery === 'string'
					? parsed.searchQuery
					: DEFAULT_SITE_MANAGER_CONTROLS.searchQuery,
			sort: parsed.sort ?? DEFAULT_SITE_MANAGER_CONTROLS.sort,
		};
	} catch {
		return DEFAULT_SITE_MANAGER_CONTROLS;
	}
}

export function persistControls(controls: SiteManagerStoredControls): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(
			siteManagerControlsStorageKey,
			JSON.stringify(controls)
		);
	} catch {
		// Search/sort persistence is best-effort; default controls keep the panel usable.
	}
}
