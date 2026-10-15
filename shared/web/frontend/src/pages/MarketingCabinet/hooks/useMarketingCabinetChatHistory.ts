import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { MarketingView } from '../constants';
import { marketingCabinetChatHistoryQueryOptions } from '../marketingCabinetQueryOptions';
import type { ChatTimelineMessage } from '../marketingCabinetPageTypes';

export function useMarketingCabinetChatHistory({
	activeView,
	selectedProjectId,
	selectedCompanyId,
	chatSessionReset,
	setConversationId,
	setChatMessages,
}: {
	activeView: MarketingView;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	chatSessionReset: boolean;
	setConversationId: (v: string | null) => void;
	setChatMessages: (v: ChatTimelineMessage[]) => void;
}) {
	const chatHistoryQuery = useQuery({
		...marketingCabinetChatHistoryQueryOptions(
			selectedProjectId,
			selectedCompanyId
		),
		enabled:
			activeView === 'chat' && Boolean(selectedProjectId || selectedCompanyId),
	});

	useEffect(() => {
		if (chatSessionReset) return;
		const data = chatHistoryQuery.data;
		if (!data) return;
		setConversationId(data.conversation_id ?? null);
		setChatMessages(
			(data.messages ?? []).flatMap((message) => {
				if (message.role !== 'user' && message.role !== 'assistant') {
					return [];
				}
				return [
					{
						id: message.id,
						role: message.role,
						content: message.content,
					} satisfies ChatTimelineMessage,
				];
			})
		);
	}, [
		chatHistoryQuery.data,
		chatSessionReset,
		setConversationId,
		setChatMessages,
	]);

	return chatHistoryQuery;
}
