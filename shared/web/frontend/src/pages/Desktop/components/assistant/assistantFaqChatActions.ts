/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure FAQ chat action helpers for «Показать в чате», composer insert, and local FAQ ids.
 *
 * Invariants:
 * - Local FAQ ids use faq-local-u-/faq-local-a- prefix; no SSE / LLM on show-in-chat.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - pages/Desktop/utils/assistantLocalFaqStorage.ts
 */
import type {
	AssistantChatMessage,
	AssistantFaqEntry,
} from '../../services/productDesktopApi';

export function buildLocalFaqMessagesFromEntry(
	entry: AssistantFaqEntry,
	options?: { stamp?: number; createdAt?: string }
): AssistantChatMessage[] {
	const stamp = options?.stamp ?? Date.now();
	const createdAt = options?.createdAt ?? new Date().toISOString();
	return [
		{
			id: `faq-local-u-${entry.id}-${stamp}`,
			role: 'user',
			content: entry.question,
			created_at: createdAt,
		},
		{
			id: `faq-local-a-${entry.id}-${stamp}`,
			role: 'assistant',
			content: entry.answer,
			created_at: createdAt,
		},
	];
}

export function appendFaqQuestionToComposer(
	currentInput: string,
	question: string
): string {
	return currentInput + (currentInput ? '\n' : '') + question;
}
