/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sidebar chat list filtering, pin order, prefetch-on-hover, and row-ref sizing for GAF Chat.
 *
 * Invariants:
 * - Search uses deferred query + precomputed haystack per chat id (no per-keystroke concat).
 * - Prefetch dedupes via rememberGafMessagePrefetch and evicts inactive message caches.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - src/pages/Desktop/components/GAFChat/components/GafChatSidebarPanel.tsx
 */
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { gafChatQueryKeys } from '../api/gafChatApi';
import {
	GAF_MESSAGE_PREFETCH_STALE_MS,
	rememberGafMessagePrefetch,
} from '../gafChatPrefetchPolicy';
import {
	savePinnedChatOrder,
	sortChatsWithPins,
	togglePinnedChat,
} from '../gafChatPinnedChats';
import { gafChatMessagesInfiniteQueryOptions } from '../gafChatQueryOptions';
import type { GAFChatListItem, GAFMessageItem } from '../types';

export type UseGafChatSidebarListInput = {
	myUserId: string | null;
	chats: GAFChatListItem[];
	searchQuery: string;
	sidebarFilter: 'all' | 'unread';
	pinnedChatIds: string[];
	setPinnedChatIds: Dispatch<SetStateAction<string[]>>;
	selectedChatId: string | null;
	setSelectedChatId: (id: string) => void;
	chatListRowRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
};

export function useGafChatSidebarList({
	myUserId,
	chats,
	searchQuery,
	sidebarFilter,
	pinnedChatIds,
	setPinnedChatIds,
	selectedChatId,
	setSelectedChatId,
	chatListRowRefs,
}: UseGafChatSidebarListInput) {
	const { t } = useTranslation('gafChat');
	const queryClient = useQueryClient();
	const deferredSearchQuery = useDeferredValue(searchQuery);

	const sortedChats = useMemo(() => {
		let base = chats;
		if (sidebarFilter === 'unread') {
			base = base.filter((c) => c.unread_count > 0);
		}
		if (!myUserId) return base;
		return sortChatsWithPins(base, pinnedChatIds);
	}, [chats, sidebarFilter, pinnedChatIds, myUserId]);

	const chatSearchHayById = useMemo(() => {
		const m = new Map<string, string>();
		for (const c of sortedChats) {
			const hay =
				`${c.partner?.full_name || ''} ${c.partner?.username || ''} ${c.last_message_preview || ''}`
					.toLowerCase()
					.replace(/\s+/g, ' ');
			m.set(c.chat_id, hay);
		}
		return m;
	}, [sortedChats]);

	const filteredChats = useMemo(() => {
		const q = deferredSearchQuery.trim().toLowerCase();
		if (!q) return sortedChats;
		return sortedChats.filter((c) => {
			const hay = chatSearchHayById.get(c.chat_id) ?? '';
			return hay.includes(q);
		});
	}, [sortedChats, deferredSearchQuery, chatSearchHayById]);

	const filteredChatsRef = useRef<GAFChatListItem[]>([]);
	useEffect(() => {
		filteredChatsRef.current = filteredChats;
	}, [filteredChats]);

	const prefetchedMessageChatIdsRef = useRef<string[]>([]);

	const prefetchChatMessages = useCallback(
		(chatId: string) => {
			if (!chatId || chatId === selectedChatId) return;
			const remembered = rememberGafMessagePrefetch(
				prefetchedMessageChatIdsRef.current,
				chatId
			);
			prefetchedMessageChatIdsRef.current = remembered.next;
			if (!remembered.shouldPrefetch) return;
			for (const evictedChatId of remembered.evicted) {
				if (evictedChatId === selectedChatId) continue;
				queryClient.removeQueries({
					queryKey: gafChatQueryKeys.messages(evictedChatId),
					exact: true,
					type: 'inactive',
				});
			}
			void queryClient.prefetchInfiniteQuery({
				...gafChatMessagesInfiniteQueryOptions(chatId),
				staleTime: GAF_MESSAGE_PREFETCH_STALE_MS,
			});
		},
		[queryClient, selectedChatId]
	);

	const handleTogglePin = useCallback(
		(chatId: string) => {
			if (!myUserId) return;
			setPinnedChatIds((prev) => {
				const next = togglePinnedChat(chatId, prev);
				if (next === prev && !prev.includes(chatId)) {
					toast.error(t('sidebarPinLimitToast'));
				}
				savePinnedChatOrder(myUserId, next);
				return next;
			});
		},
		[myUserId, setPinnedChatIds, t]
	);

	useLayoutEffect(() => {
		chatListRowRefs.current.length = filteredChats.length;
	}, [filteredChats.length, chatListRowRefs]);

	const handleSelectChat = useCallback(
		(id: string) => {
			setSelectedChatId(id);
		},
		[setSelectedChatId]
	);

	return {
		filteredChats,
		filteredChatsRef,
		prefetchChatMessages,
		handleTogglePin,
		handleSelectChat,
	};
}

/** Ensures empty-thread cache is hydrated on first open. */
export function useGafChatEnsureMessagesOnSelect(
	selectedChatId: string | null,
	queryClient: ReturnType<typeof useQueryClient>
) {
	useEffect(() => {
		if (!selectedChatId) return;
		const id = selectedChatId;
		const raf = requestAnimationFrame(() => {
			const data = queryClient.getQueryData<InfiniteData<GAFMessageItem[]>>(
				gafChatQueryKeys.messages(id)
			);
			const flat = data?.pages?.flat() ?? [];
			if (flat.length > 0) return;
			void queryClient.refetchQueries({
				queryKey: gafChatQueryKeys.messages(id),
				exact: true,
			});
		});
		return () => cancelAnimationFrame(raf);
	}, [selectedChatId, queryClient]);
}
