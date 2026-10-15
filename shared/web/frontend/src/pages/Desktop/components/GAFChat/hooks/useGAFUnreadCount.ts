/**
 * Unread total for the GAF chat launcher / header badge.
 *
 * Behavior:
 * - Uses the same React Query key as the full chat list (`['gaf-chat', 'chats']`), so one
 *   `listChats` fetch backs both the inbox UI and this number; `invalidateQueries` on that
 *   key updates the badge immediately.
 * - `select` reduces the cached list to a single number so consumers re-render only when the
 *   total changes, not on every chat row update.
 * - Muted partners are excluded (`partner.is_muted`); their `unread_count` is ignored.
 * - When `enabled` is false, the observer is inactive (no fetch); callers gate on desktop/GAF
 *   readiness as needed.
 *
 * Caching vs app defaults (`App.tsx` QueryClient): global `staleTime` is 5m and
 * `refetchOnWindowFocus` is false. This query uses a shorter `staleTime` (15s) so the badge
 * can drift toward fresh data without relying only on invalidations, and sets
 * `refetchOnWindowFocus: true` so returning to the browser tab can refetch when the query is
 * stale (not on every focus while still fresh — TanStack Query gates on staleness).
 * `refetchOnReconnect: true` is set explicitly so after a network drop the badge refetches
 * when the browser fires `online` (same staleness gating as focus).
 *
 * **Logout / session end:** `GAFChatProvider` (Desktop) runs
 * `queryClient.removeQueries({ queryKey: gafChatQueryKeys.all })` when `user` transitions
 * from defined to undefined. That clears the shared `chats` cache (and `me`, message queries),
 * so the unread badge does not show the previous account’s counts; when `enabled` becomes
 * true again for the next session, the query starts fresh.
 *
 * Optional second argument: `refetchInterval` (ms or `false`) when callers want polling while
 * enabled. For a badge pulse during fetch, use named export `useGAFUnreadCountMeta` (same
 * query key — shares cache with the inbox).
 */
import { useQuery } from '@tanstack/react-query';
import type { GAFChatListItem } from '../types';
import {
	GAF_CHAT_CHATS_BADGE_STALE_MS,
	gafChatChatsQueryOptions,
} from '../gafChatQueryOptions';

export type UseGAFUnreadCountOptions = {
	/** When set, passed to React Query (only while `enabled` is true). Omit for default (no polling). */
	refetchInterval?: number | false;
};

/** Stable selector: subscribers only re-render when the numeric total changes. */
function selectUnreadTotalFromChats(
	chats: GAFChatListItem[] | undefined
): number {
	if (!Array.isArray(chats)) {
		return 0;
	}
	let total = 0;
	for (const c of chats) {
		if (c.partner?.is_muted) {
			continue;
		}
		total += c.unread_count ?? 0;
	}
	return total;
}

function useGAFUnreadCountQuery(
	enabled: boolean,
	options?: UseGAFUnreadCountOptions
) {
	const refetchInterval = options?.refetchInterval;
	return useQuery({
		...gafChatChatsQueryOptions(),
		enabled,
		staleTime: GAF_CHAT_CHATS_BADGE_STALE_MS,
		gcTime: 5 * 60 * 1000,
		select: selectUnreadTotalFromChats,
		// Override app default `refetchOnWindowFocus: false` — badge should catch up when the
		// user comes back to the tab (refetch runs when data is stale; see module doc).
		refetchOnWindowFocus: true,
		// Explicit default for badge: refetch after reconnect (TanStack default is true; kept
		// explicit so global QueryClient changes cannot silently disable it).
		refetchOnReconnect: true,
		...(refetchInterval !== undefined ? { refetchInterval } : {}),
	});
}

/** Unread total only (backward compatible: still `number`). */
export function useGAFUnreadCount(
	enabled: boolean,
	options?: UseGAFUnreadCountOptions
): number {
	const { data: unreadTotal = 0 } = useGAFUnreadCountQuery(enabled, options);
	return unreadTotal;
}

/**
 * Same cache as `useGAFUnreadCount`, plus `isFetching` for e.g. badge pulse while refetching.
 */
export function useGAFUnreadCountMeta(
	enabled: boolean,
	options?: UseGAFUnreadCountOptions
): { count: number; isFetching: boolean } {
	const { data: count = 0, isFetching } = useGAFUnreadCountQuery(
		enabled,
		options
	);
	return { count, isFetching };
}
