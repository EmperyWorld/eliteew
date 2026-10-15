/**
 * Закреплённые чаты GAF (порядок в localStorage). Сервер не хранит — только UX на устройстве.
 */

import type { GAFChatListItem } from './types';

const STORAGE_PREFIX = 'eliteew.gafChat.pinnedChats.v1::';
const MAX_PINS = 40;

function key(userId: string): string {
	return `${STORAGE_PREFIX}${userId}`;
}

export function loadPinnedChatOrder(userId: string): string[] {
	try {
		const raw = window.localStorage.getItem(key(userId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((x): x is string => typeof x === 'string' && x.length > 0)
			.slice(0, MAX_PINS);
	} catch {
		return [];
	}
}

export function savePinnedChatOrder(userId: string, chatIds: string[]): void {
	try {
		const next = chatIds.filter(Boolean).slice(0, MAX_PINS);
		window.localStorage.setItem(key(userId), JSON.stringify(next));
	} catch {
		/* ignore */
	}
}

/** Закрепить / открепить; новые пины в начало списка. */
export function togglePinnedChat(
	chatId: string,
	currentOrder: string[]
): string[] {
	const set = new Set(currentOrder);
	if (set.has(chatId)) {
		return currentOrder.filter((id) => id !== chatId);
	}
	if (currentOrder.length >= MAX_PINS) {
		return currentOrder;
	}
	return [chatId, ...currentOrder.filter((id) => id !== chatId)];
}

export function sortChatsWithPins(
	chats: GAFChatListItem[],
	pinnedOrder: string[]
): GAFChatListItem[] {
	const byId = new Map(chats.map((c) => [c.chat_id, c]));
	const pinned: GAFChatListItem[] = [];
	for (const id of pinnedOrder) {
		const row = byId.get(id);
		if (row) pinned.push(row);
	}
	const pinnedSet = new Set(pinnedOrder);
	const rest = chats.filter((c) => !pinnedSet.has(c.chat_id));
	rest.sort((a, b) => {
		const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
		const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
		return tb - ta;
	});
	return [...pinned, ...rest];
}
