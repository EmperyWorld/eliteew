/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auto-fetch next EWDesk feed page when sentinel enters the list scrollport.
 *
 * Invariants:
 * - Observes only when hasNextPage and scroll root + sentinel refs are mounted.
 *
 * Related:
 * - EWDeskApp.tsx, useEwDeskNewsFeed.ts
 */

import * as React from 'react';

export function useEwDeskNewsAutoLoadMore(
	scrollRootRef: React.RefObject<HTMLElement | null>,
	sentinelRef: React.RefObject<HTMLElement | null>,
	opts: {
		enabled: boolean;
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		fetchNextPage: () => Promise<unknown>;
	}
): void {
	const { enabled, hasNextPage, isFetchingNextPage, fetchNextPage } = opts;

	React.useEffect(() => {
		const root = scrollRootRef.current;
		const sentinel = sentinelRef.current;
		if (!enabled || !root || !sentinel || !hasNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ root, rootMargin: '160px 0px', threshold: 0 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [
		enabled,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		scrollRootRef,
		sentinelRef,
	]);
}
