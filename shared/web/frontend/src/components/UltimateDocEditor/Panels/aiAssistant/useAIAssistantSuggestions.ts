/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tracked AI suggestion queue (pending / accepted / rejected) for the doc editor panel.
 *
 * Invariants:
 * - Accept routes through insert/replace (pre-insert policy stays upstream).
 *
 * Related:
 * - useAIAssistantInsertPolicy.ts, AIAssistantSuggestionsList.tsx
 */

import { useState } from 'react';
import type { AIAssistantSuggestion } from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';

type UseAIAssistantSuggestionsArgs = {
	selectedText?: string;
	handleInsert: (text: string) => Promise<void>;
	handleReplace: (text: string) => Promise<void>;
};

export function useAIAssistantSuggestions({
	selectedText,
	handleInsert,
	handleReplace,
}: UseAIAssistantSuggestionsArgs) {
	const [suggestions, setSuggestions] = useState<AIAssistantSuggestion[]>([]);

	const queueSuggestion = (text: string): void => {
		const trimmed = text.trim();
		if (!trimmed) {
			return;
		}
		const id =
			typeof window !== 'undefined' &&
			typeof window.crypto?.randomUUID === 'function'
				? window.crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		setSuggestions((prev) => [
			{
				id,
				text: trimmed,
				status: 'pending',
				createdAt: new Date().toISOString(),
			},
			...prev,
		]);
	};

	const handleAcceptSuggestion = async (
		id: string,
		text: string
	): Promise<void> => {
		if (selectedText) {
			await handleReplace(text);
		} else {
			await handleInsert(text);
		}
		setSuggestions((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, status: 'accepted' } : item
			)
		);
	};

	const handleRejectSuggestion = (id: string): void => {
		setSuggestions((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, status: 'rejected' } : item
			)
		);
	};

	return {
		suggestions,
		queueSuggestion,
		handleAcceptSuggestion,
		handleRejectSuggestion,
	};
}
