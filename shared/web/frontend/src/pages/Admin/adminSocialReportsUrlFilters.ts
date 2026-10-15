/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Serialize Social Hub admin report queue filters to URL (`section=socialReports`).
 *
 * Related:
 * - SocialReportsAdminSection.tsx
 * - shell/adminShellUrl.ts
 */

export const SOCIAL_REPORTS_ONLY_QUERY_KEYS = [
	'report',
	'status',
	'q',
] as const;

export type AdminSocialReportsUrlState = {
	reportId: string | null;
	status: string;
	q: string;
};

export function parseAdminSocialReportsUrl(
	search: URLSearchParams
): AdminSocialReportsUrlState | null {
	if (!SOCIAL_REPORTS_ONLY_QUERY_KEYS.some((k) => search.get(k))) {
		return null;
	}
	return {
		reportId: search.get('report')?.trim() || null,
		status: search.get('status')?.trim() ?? '',
		q: search.get('q')?.trim() ?? '',
	};
}

export function buildAdminSocialReportsSearchParams(
	state: AdminSocialReportsUrlState
): URLSearchParams {
	const sp = new URLSearchParams();
	sp.set('section', 'socialReports');
	if (state.reportId) sp.set('report', state.reportId);
	if (state.status) sp.set('status', state.status);
	if (state.q) sp.set('q', state.q);
	return sp;
}

export function replaceAdminSocialReportsUrl(
	state: AdminSocialReportsUrlState
): void {
	if (typeof window === 'undefined') return;
	try {
		const url = new URL(window.location.href);
		for (const key of SOCIAL_REPORTS_ONLY_QUERY_KEYS) {
			url.searchParams.delete(key);
		}
		const built = buildAdminSocialReportsSearchParams(state);
		for (const [key, value] of built.entries()) {
			url.searchParams.set(key, value);
		}
		window.history.replaceState(null, '', url.toString());
	} catch {
		/* ignore */
	}
}

export function readReportIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return (
			new URLSearchParams(window.location.search).get('report')?.trim() || null
		);
	} catch {
		return null;
	}
}
