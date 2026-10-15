/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge Socket.IO `desktop_ai_chat.message_new` rows into the flat messages tail (GAF-aligned).
 *
 * Invariants:
 * - Deduplicate by stable message id.
 * - Replace same-turn local-* optimistic user rows when the persisted peer/self row arrives.
 *
 * Related:
 * - hooks/useDesktopAiChatRealtime.ts
 * - pages/Desktop/components/GAFChat/gafChatMessageUtils.ts
 */
import type { DesktopAiMessage } from '../api/desktopChatClient';

export function mergeDesktopAiChatSocketMessage(
	prev: DesktopAiMessage[],
	incoming: DesktopAiMessage
): DesktopAiMessage[] {
	const id = typeof incoming.id === 'string' ? incoming.id.trim() : '';
	if (!id) return prev;
	if (prev.some((m) => m.id === id)) return prev;

	const role = incoming.role;
	const author =
		typeof incoming.author_user_id === 'string'
			? incoming.author_user_id.trim()
			: '';

	if (role === 'user') {
		const withoutOptimistic = prev.filter((m) => {
			if (!m.id.startsWith('local-')) return true;
			if (m.role !== 'user') return true;
			if (author && m.author_user_id && m.author_user_id !== author) {
				return true;
			}
			return false;
		});
		return [...withoutOptimistic, incoming];
	}

	if (role === 'assistant') {
		const withoutLocalAsst = prev.filter(
			(m) => !(m.id.startsWith('local-') && m.role === 'assistant')
		);
		return [...withoutLocalAsst, incoming];
	}

	return [...prev, incoming];
}
