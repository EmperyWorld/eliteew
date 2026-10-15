/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auto-fetch next UGS Hub task page when sentinel enters viewport or scroll container.
 *
 * Invariants:
 * - Observes only when enabled, hasNextPage, and sentinel ref is mounted.
 * - Does not fire while isFetchingNextPage is true.
 *
 * Related:
 * - components/UGSHub.tsx, useUgsTasksInfinite.ts, useUgsHubTasksBacklogPrefetch.ts
 */

import * as React from 'react';

export function useUgsTasksAutoLoadMore(
	sentinelRef: React.RefObject<HTMLElement | null>,
	opts: {
		enabled: boolean;
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		fetchNextPage: () => Promise<unknown>;
		/** Custom scrollport; omit for document viewport. */
		scrollRootRef?: React.RefObject<HTMLElement | null>;
	}
): void {
	const {
		enabled,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		scrollRootRef,
	} = opts;

	const isFetchingRef = React.useRef(isFetchingNextPage);
	isFetchingRef.current = isFetchingNextPage;

	React.useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!enabled || !sentinel || !hasNextPage) return;

		const root = scrollRootRef?.current ?? null;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingRef.current) {
					void fetchNextPage();
				}
			},
			{ root, rootMargin: '240px 0px', threshold: 0 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [enabled, fetchNextPage, hasNextPage, scrollRootRef, sentinelRef]);
}
