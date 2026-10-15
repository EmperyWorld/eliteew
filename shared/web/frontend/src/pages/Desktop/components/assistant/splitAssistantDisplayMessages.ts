/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge server chat history with local FAQ inserts and split visible window for history sidebar.
 *
 * Invariants:
 * - Merged list is sorted by created_at ascending.
 *
 * Related:
 * - pages/Desktop/components/assistant/assistantChatConstants.ts
 * - pages/Desktop/components/assistant/useAssistantChatHistory.ts
 */
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import { ASSISTANT_CHAT_VISIBLE_COUNT } from './assistantChatConstants';

export function mergeAssistantDisplayMessages(
	messages: AssistantChatMessage[],
	localFaqMessages: AssistantChatMessage[]
): AssistantChatMessage[] {
	if (localFaqMessages.length === 0) return messages;
	const merged = [...messages, ...localFaqMessages];
	merged.sort(
		(a, b) =>
			new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	);
	return merged;
}

export function splitAssistantVisibleMessages(
	displayMessages: AssistantChatMessage[],
	visibleCount = ASSISTANT_CHAT_VISIBLE_COUNT
): {
	hasOlderThanVisible: boolean;
	olderMessages: AssistantChatMessage[];
	recentMessages: AssistantChatMessage[];
	allVisibleMessages: AssistantChatMessage[];
} {
	const hasOlderThanVisible = displayMessages.length > visibleCount;
	const olderMessages = hasOlderThanVisible
		? displayMessages.slice(0, -visibleCount)
		: [];
	const recentMessages = hasOlderThanVisible
		? displayMessages.slice(-visibleCount)
		: displayMessages;
	return {
		hasOlderThanVisible,
		olderMessages,
		recentMessages,
		allVisibleMessages: [...olderMessages, ...recentMessages],
	};
}

export function findLastPersistedAssistantId(
	messages: AssistantChatMessage[]
): string | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		if (messages[i]?.role === 'assistant') return messages[i].id;
	}
	return null;
}

export function findUserQuestionBeforeAssistant(
	assistantIndex: number,
	pool: AssistantChatMessage[]
): string {
	for (let i = assistantIndex - 1; i >= 0; i -= 1) {
		if (pool[i]?.role === 'user') return pool[i].content;
	}
	return '';
}
