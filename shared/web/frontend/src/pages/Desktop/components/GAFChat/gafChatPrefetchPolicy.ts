/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bounded prefetch policy for GAF Chat hover-driven message cache warmups.
 *
 * Invariants:
 * - Hover prefetch never records unbounded chat ids in a long desktop session.
 * - Duplicate hover events do not reorder or trigger another prefetch.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 */

export const GAF_MESSAGE_PREFETCH_MAX_CHATS = 12;
export const GAF_MESSAGE_PREFETCH_STALE_MS = 30_000;
export const GAF_MESSAGE_QUERY_GC_MS = 2 * 60 * 1000;

export function rememberGafMessagePrefetch(
	current: readonly string[],
	chatId: string,
	maxChats = GAF_MESSAGE_PREFETCH_MAX_CHATS
): { next: string[]; evicted: string[]; shouldPrefetch: boolean } {
	const normalized = chatId.trim();
	if (!normalized || current.includes(normalized)) {
		return { next: [...current], evicted: [], shouldPrefetch: false };
	}
	const next = [...current, normalized];
	const evicted =
		next.length > maxChats ? next.splice(0, next.length - maxChats) : [];
	return { next, evicted, shouldPrefetch: true };
}
