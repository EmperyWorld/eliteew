import type { GAFMessageItem } from './types';

/** Ordered message ids whose plain body matches the in-thread search (non-deleted only). */
export function buildThreadSearchMatchIds(
	messages: GAFMessageItem[],
	myUserId: string | null,
	queryLower: string
): string[] {
	if (!queryLower || myUserId == null || messages.length === 0) return [];
	const out: string[] = [];
	for (const m of messages) {
		const isMine = m.sender_id === myUserId;
		const isDeleted = isMine ? m.deleted_for_sender : m.deleted_for_recipient;
		if (isDeleted) continue;
		if (
			String(m.body ?? '')
				.toLowerCase()
				.includes(queryLower)
		) {
			out.push(m.id);
		}
	}
	return out;
}
