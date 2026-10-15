/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derives partner last-read message index in the current thread for read-receipt UI.
 *
 * Invariants:
 * - Returns -1 when no partner read cursor or message id not in loaded pages.
 *
 * Related:
 * - GAFChatApp.tsx
 * - gafChatMessageUtils.ts
 */
import { useMemo } from 'react';
import type { GAFMessageItem } from '../types';

export function useGafChatPartnerReadIndex(options: {
	selectedChatId: string | null;
	partnerLastReadByChat: Record<string, string | null>;
	messages: GAFMessageItem[];
}) {
	const { selectedChatId, partnerLastReadByChat, messages } = options;

	const messageOrder = useMemo(
		() => new Map(messages.map((message, index) => [message.id, index])),
		[messages]
	);
	const partnerLastReadId =
		selectedChatId != null
			? partnerLastReadByChat[selectedChatId] || null
			: null;

	return useMemo(() => {
		if (partnerLastReadId == null) return -1;
		return messageOrder.get(partnerLastReadId) ?? -1;
	}, [messageOrder, partnerLastReadId]);
}
