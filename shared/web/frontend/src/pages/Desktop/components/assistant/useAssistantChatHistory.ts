/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server history query merge with local FAQ messages, visible window split, refresh.
 *
 * Invariants:
 * - refreshHistory is no-op while sending or clearing.
 * - messageIndexById mirrors allVisibleMessages order for O(1) lookup.
 *
 * Related:
 * - pages/Desktop/components/assistant/splitAssistantDisplayMessages.ts
 * - pages/Desktop/components/AssistantApp.tsx
 */
import type { UseQueryResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import {
	findLastPersistedAssistantId,
	mergeAssistantDisplayMessages,
	splitAssistantVisibleMessages,
} from './splitAssistantDisplayMessages';
import { useAssistantFlashTimeout } from './useAssistantFlashTimeout';

export type UseAssistantChatHistoryInput = {
	messages: AssistantChatMessage[];
	localFaqMessages: AssistantChatMessage[];
	msgQuery: Pick<
		UseQueryResult<AssistantChatMessage[]>,
		'isFetching' | 'refetch'
	>;
	sending: boolean;
	clearing: boolean;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function useAssistantChatHistory({
	messages,
	localFaqMessages,
	msgQuery,
	sending,
	clearing,
	t,
}: UseAssistantChatHistoryInput) {
	const [historyRefreshFlash, setHistoryRefreshFlash] = React.useState(false);

	useAssistantFlashTimeout(historyRefreshFlash, () =>
		setHistoryRefreshFlash(false)
	);

	const displayMessages = React.useMemo(
		() => mergeAssistantDisplayMessages(messages, localFaqMessages),
		[messages, localFaqMessages]
	);

	const { olderMessages, recentMessages, allVisibleMessages } = React.useMemo(
		() => splitAssistantVisibleMessages(displayMessages),
		[displayMessages]
	);

	const messageIndexById = React.useMemo(() => {
		const indexById = new Map<string, number>();
		for (let i = 0; i < allVisibleMessages.length; i += 1) {
			indexById.set(allVisibleMessages[i].id, i);
		}
		return indexById;
	}, [allVisibleMessages]);

	const lastPersistedAssistantId = React.useMemo(
		() => findLastPersistedAssistantId(messages),
		[messages]
	);

	const refreshHistory = React.useCallback(async () => {
		if (sending || clearing) return;
		try {
			const result = await msgQuery.refetch();
			if (result.isSuccess) {
				setHistoryRefreshFlash(true);
			}
		} catch {
			toast.error(t('historyError'));
		}
	}, [clearing, msgQuery, sending, t]);

	return {
		displayMessages,
		olderMessages,
		recentMessages,
		allVisibleMessages,
		messageIndexById,
		lastPersistedAssistantId,
		historyRefreshFlash,
		refreshHistory,
	};
}
