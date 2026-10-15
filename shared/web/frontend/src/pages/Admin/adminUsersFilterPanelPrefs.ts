/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * localStorage prefs for Users catalog filter panel (expanded/collapsed).
 */

const FILTERS_EXPANDED_KEY = 'eliteew.admin.users.filtersExpanded.v1';

export function loadAdminUsersFiltersExpanded(): boolean {
	try {
		const v = localStorage.getItem(FILTERS_EXPANDED_KEY);
		if (v === 'false') return false;
		return true;
	} catch {
		return true;
	}
}

export function saveAdminUsersFiltersExpanded(expanded: boolean): void {
	try {
		localStorage.setItem(FILTERS_EXPANDED_KEY, expanded ? 'true' : 'false');
	} catch {
		/* ignore */
	}
}
