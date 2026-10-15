/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coalesce concurrent UGS Hub infinite-query page fetches (scroll sentinel + backlog prefetch).
 *
 * Invariants:
 * - Parallel callers share one in-flight promise until it settles.
 *
 * Related:
 * - components/UGSHub.tsx
 */

export function createCoalescedFetchNextPage(
	fetchNextPage: () => Promise<unknown>
): () => Promise<unknown> {
	let inFlight: Promise<unknown> | null = null;

	return () => {
		if (inFlight) {
			return inFlight;
		}
		inFlight = fetchNextPage().finally(() => {
			inFlight = null;
		});
		return inFlight;
	};
}
