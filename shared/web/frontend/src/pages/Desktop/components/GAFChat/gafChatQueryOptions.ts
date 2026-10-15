/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 `queryOptions` / `infiniteQueryOptions` for GAF Chat caches.
 *
 * Invariants:
 * - Same options for `useQuery` / `useInfiniteQuery` and prefetch helpers (single cache key).
 * - Invalidation uses `.queryKey` from these helpers or `gafChatQueryKeys`.
 *
 * Related:
 * - api/gafChatApi.ts, hooks/useGafChatMessages.ts, GAFChatApp.tsx, hooks/useGAFUnreadCount.ts
 */

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
	gafChatQueryKeys,
	getMe,
	listChats,
	listMessages,
	listPartnerDesktopAppsForAdmin,
} from './api/gafChatApi';
import { GAF_MESSAGE_QUERY_GC_MS } from './gafChatPrefetchPolicy';
import { GAF_CHAT_PAGE_SIZE, sortMessagesAsc } from './gafChatMessageUtils';
import type { GAFMessageItem } from './types';
import {
	DESKTOP_SHELL_BOOTSTRAP_STALE_MS,
	DESKTOP_SHELL_GAF_CHATS_STALE_MS,
} from '../../services/desktopShellQueryFreshness';

export const GAF_CHAT_CHATS_STALE_MS = DESKTOP_SHELL_GAF_CHATS_STALE_MS;
/** Align with shell-bootstrap seed so cold `#desktop` does not remount-refetch `/gaf/me`. */
export const GAF_CHAT_ME_STALE_MS = DESKTOP_SHELL_BOOTSTRAP_STALE_MS;
/** Shorter window for badge / unread observers sharing the chats cache. */
export const GAF_CHAT_CHATS_BADGE_STALE_MS = 15_000;
export const GAF_CHAT_CHATS_START_MENU_STALE_MS = 30_000;
export const GAF_MESSAGE_STALE_MS = 15_000;
export const GAF_CHAT_PARTNER_APPS_STALE_MS = 30_000;

export function gafChatMeQueryOptions() {
	return queryOptions({
		queryKey: gafChatQueryKeys.me,
		queryFn: getMe,
		staleTime: GAF_CHAT_ME_STALE_MS,
	});
}

export function gafChatChatsQueryOptions() {
	return queryOptions({
		queryKey: gafChatQueryKeys.chats,
		queryFn: listChats,
		staleTime: GAF_CHAT_CHATS_STALE_MS,
	});
}

export function gafChatMessagesInfiniteQueryOptions(chatId: string) {
	return infiniteQueryOptions({
		queryKey: gafChatQueryKeys.messages(chatId),
		queryFn: async ({ pageParam }) => {
			const raw = await listMessages(chatId, {
				limit: GAF_CHAT_PAGE_SIZE,
				before: pageParam as string | undefined,
			});
			return sortMessagesAsc(raw);
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage: GAFMessageItem[]) => {
			if (!lastPage.length || lastPage.length < GAF_CHAT_PAGE_SIZE) {
				return undefined;
			}
			return lastPage[0]?.id;
		},
		staleTime: GAF_MESSAGE_STALE_MS,
		gcTime: GAF_MESSAGE_QUERY_GC_MS,
	});
}

export function gafChatPartnerDesktopAppsQueryOptions(chatId: string) {
	return queryOptions({
		queryKey: [
			...gafChatQueryKeys.messages(chatId),
			'partner-desktop-apps',
		] as const,
		queryFn: () => listPartnerDesktopAppsForAdmin(chatId),
		staleTime: GAF_CHAT_PARTNER_APPS_STALE_MS,
	});
}

/** Scoped messages list for Marketing Cabinet client-interaction chat (limit 80, not infinite). */
export const GAF_CHAT_MC_CLIENT_IX_SCOPE = 'mc-client-ix' as const;

export function gafChatMcClientInteractionMessagesQueryKey(
	chatId: string | null
) {
	return [
		...gafChatQueryKeys.messages(chatId),
		GAF_CHAT_MC_CLIENT_IX_SCOPE,
	] as const;
}

export function gafChatMcClientInteractionMessagesQueryOptions(
	chatId: string | null
) {
	return queryOptions({
		queryKey: gafChatMcClientInteractionMessagesQueryKey(chatId),
		queryFn: () => {
			if (!chatId) {
				throw new Error('chatId required');
			}
			return listMessages(chatId, { limit: 80 });
		},
		staleTime: GAF_MESSAGE_STALE_MS,
		gcTime: GAF_MESSAGE_QUERY_GC_MS,
	});
}
