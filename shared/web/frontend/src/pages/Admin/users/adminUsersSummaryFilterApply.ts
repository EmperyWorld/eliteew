/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Users hub summary-bar filter toggles (mutually exclusive flags).
 *
 * Invariants:
 * - Each apply clears sibling summary flags (online / anomaly / SSO / mismatch).
 *
 * Related:
 * - `pages/Admin/users/useAdminUsersHubFilters.ts`
 */

export type AdminUsersSummaryFilterSetters = {
	setOnlineOnly: (v: boolean) => void;
	setAnomalyOnly: (v: boolean) => void;
	setSsoBrowserOnly: (v: boolean) => void;
	setSsoMobileOnly: (v: boolean) => void;
	setSsoDesktopOnly: (v: boolean) => void;
	setMismatchOnly: (v: boolean) => void;
	setPage: (updater: number | ((n: number) => number)) => void;
};

function clearSiblingSummaryFlags(
	s: AdminUsersSummaryFilterSetters,
	keep: keyof Omit<AdminUsersSummaryFilterSetters, 'setPage'>
): void {
	if (keep !== 'setOnlineOnly') s.setOnlineOnly(false);
	if (keep !== 'setAnomalyOnly') s.setAnomalyOnly(false);
	if (keep !== 'setSsoBrowserOnly') s.setSsoBrowserOnly(false);
	if (keep !== 'setSsoMobileOnly') s.setSsoMobileOnly(false);
	if (keep !== 'setSsoDesktopOnly') s.setSsoDesktopOnly(false);
	if (keep !== 'setMismatchOnly') s.setMismatchOnly(false);
}

export function applySummaryOnlineFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setOnlineOnly');
	s.setOnlineOnly(true);
	s.setPage(1);
}

export function applySummaryAnomalyFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setAnomalyOnly');
	s.setAnomalyOnly(true);
	s.setPage(1);
}

export function applySummarySsoBrowserFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setSsoBrowserOnly');
	s.setSsoBrowserOnly(true);
	s.setPage(1);
}

export function applySummarySsoMobileFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setSsoMobileOnly');
	s.setSsoMobileOnly(true);
	s.setPage(1);
}

export function applySummarySsoDesktopFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setSsoDesktopOnly');
	s.setSsoDesktopOnly(true);
	s.setPage(1);
}

export function applySummaryMismatchFilter(
	s: AdminUsersSummaryFilterSetters
): void {
	clearSiblingSummaryFlags(s, 'setMismatchOnly');
	s.setMismatchOnly(true);
	s.setPage(1);
}
