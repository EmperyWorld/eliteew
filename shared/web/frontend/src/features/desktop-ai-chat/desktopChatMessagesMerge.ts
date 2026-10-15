/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge helpers and window sizes for Desktop AI Chat message history (tail + older pages).
 *
 * Invariants:
 * - Initial UI window is a short contiguous suffix (`DESKTOP_AI_MESSAGES_TAIL`).
 * - Older pages load immediately before the loaded window (not from chat offset 0 in one dump).
 *
 * Related:
 * - hooks/useDesktopAiChatMessages.ts, documentation/product/DESKTOP-LLAMA-CHAT.md
 */

import type {
	DesktopAiMessage,
	ListDesktopAiMessagesResult,
} from './api/desktopChatClient';

/** Initial GET /messages?tail= — short visible window so long threads do not freeze the SPA. */
export const DESKTOP_AI_MESSAGES_TAIL = 6;

/** Each «Show more» click prepends at most this many messages immediately before the loaded window. */
export const DESKTOP_AI_MESSAGES_OLDER_PAGE = 6;

export function countPersistedDesktopAiMessages(
	messages: DesktopAiMessage[]
): number {
	return messages.filter((m) => !m.id.startsWith('local-')).length;
}

/**
 * Next older-page query for a contiguous suffix already in memory.
 * Returns null when nothing remains above the loaded window.
 */
export function nextOlderMessagesQuery(
	messagesTotal: number,
	persistedLoaded: number,
	pageSize: number = DESKTOP_AI_MESSAGES_OLDER_PAGE
): { offset: number; limit: number } | null {
	if (
		messagesTotal <= 0 ||
		persistedLoaded < 0 ||
		persistedLoaded >= messagesTotal ||
		pageSize <= 0
	) {
		return null;
	}
	const remaining = messagesTotal - persistedLoaded;
	const limit = Math.min(pageSize, remaining);
	const offset = messagesTotal - persistedLoaded - limit;
	if (offset < 0 || limit <= 0) {
		return null;
	}
	return { offset, limit };
}

function cmpMessage(a: DesktopAiMessage, b: DesktopAiMessage): number {
	const ta = String(a.created_at ?? '');
	const tb = String(b.created_at ?? '');
	if (ta !== tb) {
		return ta.localeCompare(tb);
	}
	return a.id.localeCompare(b.id);
}

/**
 * After a successful stream, replace the tail window from the server while keeping
 * older messages we already had loaded (prefix before the tail window).
 */
export function mergeServerTailWithOlderPrefix(
	prev: DesktopAiMessage[],
	result: ListDesktopAiMessagesResult
): DesktopAiMessage[] {
	const tailItems = result.items;
	if (tailItems.length === 0) {
		return prev.filter((m) => !m.id.startsWith('local-'));
	}
	const oldestTail = tailItems[0];
	const oldestTailTime = String(oldestTail?.created_at ?? '');
	const byId = new Map<string, DesktopAiMessage>();
	for (const m of prev) {
		if (m.id.startsWith('local-')) {
			continue;
		}
		if (
			oldestTailTime &&
			m.created_at &&
			String(m.created_at) < oldestTailTime
		) {
			byId.set(m.id, m);
		}
	}
	for (const m of tailItems) {
		byId.set(m.id, m);
	}
	return Array.from(byId.values()).sort(cmpMessage);
}

/**
 * Prepend an older slice (offset/limit from the start of the chat) into the current list.
 */
export function prependOlderSlice(
	current: DesktopAiMessage[],
	olderSlice: DesktopAiMessage[]
): DesktopAiMessage[] {
	const byId = new Map<string, DesktopAiMessage>();
	for (const m of olderSlice) {
		byId.set(m.id, m);
	}
	for (const m of current) {
		byId.set(m.id, m);
	}
	return Array.from(byId.values()).sort(cmpMessage);
}
