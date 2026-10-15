/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Serialize admin Feedback queue filters to URL (`section=feedback`).
 *
 * Related:
 * - `pages/Admin/FeedbackAdminSection.tsx`
 */

const MANAGED = ['ticket', 'status', 'kind', 'q', 'includeClosed'] as const;

export type AdminFeedbackUrlState = {
	ticketId: string | null;
	status: string;
	kind: string;
	q: string;
	includeClosed: boolean;
};

export function parseAdminFeedbackUrl(
	search: URLSearchParams
): AdminFeedbackUrlState | null {
	if (!MANAGED.some((k) => search.get(k))) return null;
	return {
		ticketId: search.get('ticket')?.trim() || null,
		status: search.get('status')?.trim() ?? '',
		kind: search.get('kind')?.trim() ?? '',
		q: search.get('q')?.trim() ?? '',
		includeClosed: search.get('includeClosed') === '1',
	};
}

export function buildAdminFeedbackSearchParams(
	state: AdminFeedbackUrlState
): URLSearchParams {
	const sp = new URLSearchParams();
	sp.set('section', 'feedback');
	if (state.ticketId) sp.set('ticket', state.ticketId);
	if (state.status) sp.set('status', state.status);
	if (state.kind === 'wish' || state.kind === 'bug') sp.set('kind', state.kind);
	if (state.q) sp.set('q', state.q);
	if (state.includeClosed) sp.set('includeClosed', '1');
	return sp;
}

export function replaceAdminFeedbackUrl(state: AdminFeedbackUrlState): void {
	if (typeof window === 'undefined') return;
	try {
		const url = new URL(window.location.href);
		for (const key of MANAGED) url.searchParams.delete(key);
		const built = buildAdminFeedbackSearchParams(state);
		for (const [key, value] of built.entries()) {
			url.searchParams.set(key, value);
		}
		window.history.replaceState(null, '', url.toString());
	} catch {
		/* ignore */
	}
}
