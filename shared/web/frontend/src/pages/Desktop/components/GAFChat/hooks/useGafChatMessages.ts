/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Infinite-query hook for GAF Chat message history.
 *
 * Invariants:
 * - Selected chat messages have bounded cache lifetime; hover-prefetched threads do not live for the global query GC.
 * - Realtime socket events own freshness while the chat is open, so focus refetch is disabled.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { gafChatMessagesInfiniteQueryOptions } from '../gafChatQueryOptions';

/** Paginated message history: first page = latest window, further pages use `before` cursor. */
export function useGafChatMessages(chatId: string | null) {
	return useInfiniteQuery({
		...gafChatMessagesInfiniteQueryOptions(chatId ?? ''),
		enabled: Boolean(chatId),
		refetchOnWindowFocus: false,
		refetchOnReconnect: true,
		retry: (failureCount, error) => {
			const code = (error as { statusCode?: number })?.statusCode;
			if (code === 401 || code === 403 || code === 404) return false;
			return failureCount < 2;
		},
	});
}
