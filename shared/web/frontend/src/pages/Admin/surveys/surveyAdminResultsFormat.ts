/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Format helpers for admin survey results KPI and filters.
 *
 * Related:
 * - SurveyAdminResultsKpiHero.tsx
 */

/** API returns 0–1 fraction; display as whole percent. */
export function formatSurveyCompletionRate(rate: number): string {
	if (!Number.isFinite(rate) || rate <= 0) return '0%';
	return `${Math.round(rate * 100)}%`;
}

export type SurveyResponseDateFilter = {
	submitted_from?: string;
	submitted_to?: string;
	submitted_sort?: 'asc' | 'desc';
};
