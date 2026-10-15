/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mute detection for incoming GAF messages (chat cache, friends list, payload flag).
 *
 * Invariants:
 * - payloadMuted=true short-circuits before cache lookups.
 *
 * Related:
 * - context/GAFChatProvider.tsx
 * - context/useGafChatSocketEventHandlers.ts
 */
import type { Friend, FriendsOverview } from '@/features/friends/types';
import { friendsQueryKeys } from '@/features/friends/api/queryKeys';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { gafChatQueryKeys } from '../components/GAFChat/api/gafChatApi';
import type { GAFChatListItem } from '../components/GAFChat/types';

export function useGafIncomingMuteCheck(queryClient: QueryClient) {
	const isMutedIncomingChat = useCallback(
		(
			chatId?: string | null,
			senderId?: string | null,
			payloadMuted?: boolean
		): boolean => {
			if (payloadMuted) {
				return true;
			}

			const chats = queryClient.getQueryData<GAFChatListItem[]>(
				gafChatQueryKeys.chats
			);
			if (chatId) {
				const mutedInChatCache = chats?.some(
					(chat) => chat.chat_id === chatId && chat.partner?.is_muted
				);
				if (mutedInChatCache) {
					return true;
				}
			}

			if (senderId) {
				const friendsList = queryClient.getQueryData<Friend[]>(
					friendsQueryKeys.list()
				);
				if (
					friendsList?.some(
						(friend) => friend.id === senderId && friend.is_muted
					)
				) {
					return true;
				}

				const overview = queryClient.getQueryData<FriendsOverview>(
					friendsQueryKeys.overview()
				);
				if (
					overview?.friends?.some(
						(friend) => friend.id === senderId && friend.is_muted
					)
				) {
					return true;
				}
			}

			return false;
		},
		[queryClient]
	);

	const isMutedIncomingChatRef = useRef(isMutedIncomingChat);
	isMutedIncomingChatRef.current = isMutedIncomingChat;

	return { isMutedIncomingChat, isMutedIncomingChatRef };
}
