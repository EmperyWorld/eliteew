/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers: detect EWDesk posts newer than user's last feed visit watermark.
 *
 * Invariants:
 * - ISO timestamps compared by epoch ms; invalid dates → false.
 *
 * Related:
 * - EwDeskWidgetPreview.tsx, GET /news/counts + /news/my-state
 */

function parseIsoMs(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const ms = new Date(iso).getTime();
	return Number.isFinite(ms) ? ms : null;
}

/** True when latest publish is strictly after last_seen_published_at (or last seen is absent). */
export function ewDeskHasNewsSinceLastVisit(params: {
	latestPublishedAt: string | null | undefined;
	lastSeenPublishedAt: string | null | undefined;
}): boolean {
	const latestMs = parseIsoMs(params.latestPublishedAt);
	if (latestMs == null) return false;
	const lastSeenMs = parseIsoMs(params.lastSeenPublishedAt);
	if (lastSeenMs == null) return true;
	return latestMs > lastSeenMs;
}

/** True when a single post is newer than the user's last feed visit watermark. */
export function ewDeskIsPostNewSinceVisit(params: {
	postPublishedAt: string | null | undefined;
	lastSeenPublishedAt: string | null | undefined;
}): boolean {
	const postMs = parseIsoMs(params.postPublishedAt);
	if (postMs == null) return false;
	const lastSeenMs = parseIsoMs(params.lastSeenPublishedAt);
	if (lastSeenMs == null) return true;
	return postMs > lastSeenMs;
}
