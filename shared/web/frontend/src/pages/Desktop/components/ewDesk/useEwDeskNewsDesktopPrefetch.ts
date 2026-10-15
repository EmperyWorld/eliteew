/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prefetch EWDesk counts + user-state on desktop workspace mount (badge + widget).
 *
 * Invariants:
 * - No-op when user is not authenticated (enabled=false).
 * - Debounced across remounts to avoid duplicate cold-start requests.
 *
 * Related:
 * - useDesktopWorkspaceShellBadgeCounts.ts, useEwDeskUnreadCount.ts
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
	ewDeskNewsCountsQueryOptions,
	ewDeskNewsUserStateQueryOptions,
} from './ewDeskNewsQueryOptions';
const PREFETCH_DEBOUNCE_MS = 8_000;

let lastEwDeskDesktopPrefetchAt = 0;

export function useEwDeskNewsDesktopPrefetch(enabled: boolean): void {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!enabled) return;
		const now = Date.now();
		if (now - lastEwDeskDesktopPrefetchAt < PREFETCH_DEBOUNCE_MS) {
			return;
		}
		lastEwDeskDesktopPrefetchAt = now;
		void queryClient.prefetchQuery(ewDeskNewsCountsQueryOptions());
		void queryClient.prefetchQuery(ewDeskNewsUserStateQueryOptions());
	}, [enabled, queryClient]);
}
