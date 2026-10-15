/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mark-read REST calls and partner read-receipt socket sync for the active GAF thread.
 *
 * Invariants:
 * - Optimistic message ids are excluded upstream via resolveGafLastMessageIdForRead.
 *
 * Related:
 * - GAFChatApp.tsx · gafChatMessageUtils.ts
 */
import { Services } from '@/services';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { gafChatQueryKeys, markRead } from '../api/gafChatApi';
import type { GAFChatListItem } from '../types';

export function useGafChatMarkRead(options: {
	isDesktopWindowActive: boolean;
	selectedChatId: string | null;
	messagesLoading: boolean;
	messagesLength: number;
	lastMessageIdForRead: string | undefined;
	chats: GAFChatListItem[];
	setPartnerLastReadByChat: Dispatch<
		SetStateAction<Record<string, string | null>>
	>;
}): void {
	const queryClient = useQueryClient();
	const {
		isDesktopWindowActive,
		selectedChatId,
		messagesLoading,
		messagesLength,
		lastMessageIdForRead,
		chats,
		setPartnerLastReadByChat,
	} = options;

	const selectedChatIdRef = useRef<string | null>(null);
	const chatsRef = useRef<GAFChatListItem[]>([]);
	const lastMarkedReadSignatureRef = useRef<string>('');

	useEffect(() => {
		selectedChatIdRef.current = selectedChatId;
	}, [selectedChatId]);

	useEffect(() => {
		chatsRef.current = chats;
	}, [chats]);

	useEffect(() => {
		const socket = Services.socket;
		if (!socket || typeof socket.addEventListener !== 'function') return;

		const unsubscribe = socket.addEventListener(
			'gaf_chat.message_read',
			(data: unknown) => {
				const payload =
					data && typeof data === 'object' && !Array.isArray(data)
						? (data as {
								chat_id?: string;
								user_id?: string;
								up_to_message_id?: string | null;
							})
						: undefined;
				const chatId = payload?.chat_id;
				const readerId = payload?.user_id;
				const upTo = payload?.up_to_message_id;
				if (!chatId || !readerId || !upTo) return;
				const currentSelected = selectedChatIdRef.current;
				if (chatId !== currentSelected) return;
				const partnerId =
					chatsRef.current.find((c) => c.chat_id === currentSelected)?.partner
						?.id ?? null;
				if (!partnerId || readerId !== partnerId) return;
				setPartnerLastReadByChat((prev) => ({
					...prev,
					[chatId]: upTo ?? null,
				}));
			}
		);

		return () => {
			unsubscribe();
		};
	}, [setPartnerLastReadByChat]);

	useEffect(() => {
		if (!isDesktopWindowActive) return;
		if (!selectedChatId) return;
		if (messagesLoading && messagesLength === 0) return;
		const signature = `${selectedChatId}:${lastMessageIdForRead ?? ''}`;
		if (lastMarkedReadSignatureRef.current === signature) return;
		const timerId = window.setTimeout(() => {
			lastMarkedReadSignatureRef.current = signature;
			void markRead(selectedChatId, lastMessageIdForRead)
				.then(() =>
					queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats })
				)
				.catch(() => {
					if (lastMarkedReadSignatureRef.current === signature) {
						lastMarkedReadSignatureRef.current = '';
					}
				});
		}, 280);
		return () => window.clearTimeout(timerId);
	}, [
		isDesktopWindowActive,
		selectedChatId,
		messagesLoading,
		messagesLength,
		lastMessageIdForRead,
		queryClient,
	]);
}
