/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 options for Assistant FAQ and chat message history.
 *
 * Invariants:
 * - Wave K17: FAQ queryFn persists successful catalogs and hydrates from
 *   localStorage when the network fetch fails (honest empty if no cache).
 *
 * Related:
 * - AssistantApp.tsx, productDesktopApi.ts
 * - utils/assistantFaqCatalogStorage.ts
 */

import { queryOptions } from '@tanstack/react-query';
import {
	fetchAssistantFaq,
	listAssistantMessages,
	type AssistantFaqEntry,
} from '../services/productDesktopApi';
import {
	readAssistantFaqCatalog,
	writeAssistantFaqCatalog,
} from '../utils/assistantFaqCatalogStorage';

export const ASSISTANT_QUERY_ROOT = ['product-desktop', 'assistant'] as const;
export const ASSISTANT_MESSAGES_DEFAULT_LIMIT = 100;

/** Fetch FAQ; cache on success; return cache on fetch failure when present. */
export async function fetchAssistantFaqWithOfflineCache(): Promise<
	AssistantFaqEntry[]
> {
	try {
		const data = await fetchAssistantFaq();
		writeAssistantFaqCatalog(data);
		return data;
	} catch (err) {
		const cached = readAssistantFaqCatalog();
		if (cached !== null) {
			return cached;
		}
		throw err;
	}
}

export function assistantFaqQueryOptions() {
	return queryOptions({
		queryKey: [...ASSISTANT_QUERY_ROOT, 'faq'] as const,
		queryFn: fetchAssistantFaqWithOfflineCache,
	});
}

export function assistantFaqQueryKey() {
	return assistantFaqQueryOptions().queryKey;
}

export function assistantMessagesQueryOptions(
	limit = ASSISTANT_MESSAGES_DEFAULT_LIMIT
) {
	return queryOptions({
		queryKey: [...ASSISTANT_QUERY_ROOT, 'messages'] as const,
		queryFn: () => listAssistantMessages(limit),
	});
}

export function assistantMessagesQueryKey() {
	return assistantMessagesQueryOptions().queryKey;
}
