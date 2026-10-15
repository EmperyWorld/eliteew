/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Proactively fetch next UGS Hub task pages when queue-ops snapshot signals operator backlog.
 *
 * Invariants:
 * - Runs only when caller enables (UGS admin Hub); capped at UGS_HUB_BACKLOG_PREFETCH_MAX_PAGES.
 *
 * Related:
 * - services/api/ugs/ugsHubBacklogPrefetch.ts
 * - components/UGSHub.tsx
 */

import * as React from 'react';

import type { UgsQueueOpsSnapshot } from '../../services/api/ugs/queueOps';
import {
	shouldPrefetchUgsHubTasksForBacklog,
	UGS_HUB_BACKLOG_PREFETCH_MAX_PAGES,
} from '../../services/api/ugs/ugsHubBacklogPrefetch';

const PREFETCH_DELAY_MS = 1500;

export function useUgsHubTasksBacklogPrefetch(opts: {
	enabled: boolean;
	queueOps: UgsQueueOpsSnapshot | undefined;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
	loadedTaskCount: number;
}): void {
	const {
		enabled,
		queueOps,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		loadedTaskCount,
	} = opts;

	const prefetchedPagesRef = React.useRef(0);
	const isFetchingRef = React.useRef(isFetchingNextPage);
	isFetchingRef.current = isFetchingNextPage;

	const shouldPrefetch = shouldPrefetchUgsHubTasksForBacklog(queueOps);
	const lastSnapshotTimestampRef = React.useRef<string | undefined>(undefined);

	if (queueOps?.timestamp !== lastSnapshotTimestampRef.current) {
		lastSnapshotTimestampRef.current = queueOps?.timestamp;
		prefetchedPagesRef.current = 0;
	}

	React.useEffect(() => {
		if (!enabled || !shouldPrefetch || !hasNextPage || isFetchingRef.current) {
			return;
		}
		if (prefetchedPagesRef.current >= UGS_HUB_BACKLOG_PREFETCH_MAX_PAGES) {
			return;
		}

		// Re-chain prefetch after each loaded page.
		void loadedTaskCount;

		const timer = window.setTimeout(() => {
			if (isFetchingRef.current) {
				return;
			}
			if (prefetchedPagesRef.current >= UGS_HUB_BACKLOG_PREFETCH_MAX_PAGES) {
				return;
			}
			void fetchNextPage().finally(() => {
				prefetchedPagesRef.current += 1;
			});
		}, PREFETCH_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [enabled, fetchNextPage, hasNextPage, loadedTaskCount, shouldPrefetch]);
}
