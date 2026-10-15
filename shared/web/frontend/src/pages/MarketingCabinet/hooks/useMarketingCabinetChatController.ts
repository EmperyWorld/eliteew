/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat and tool-agent send flow for the marketing cabinet: local timeline state,
 * server history hydration, and cancellable SSE for context chat.
 *
 * Invariants:
 * - Chat state resets when company/project context changes.
 * - In-flight SSE is aborted on unmount, context switch, or leaving the chat tab.
 *
 * Related:
 * - marketingCabinetApi/marketingCabinetApiStream.ts
 * - hooks/useMarketingCabinetChatHistory.ts
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cabinetNotify } from '../cabinetNotify';
import type { MarketingView } from '../constants';
import { buildMarketingChatExcerpt } from '../marketingCabinetPageHelpers';
import type { ChatTimelineMessage } from '../marketingCabinetPageTypes';
import {
	marketingWebSearchApiFields,
	readStoredMarketingWebSearchQuality,
} from '../marketingWebSearchQuality';
import {
	marketingCabinetApi,
	streamMarketingChatMessage,
	type MarketingChatResponse,
	type MarketingProject,
	type MarketingToolAgentResponse,
} from '../marketingCabinetApi';
import { extractApiErrorMessage, requireDefined } from '../utils';
import { useMarketingCabinetChatHistory } from './useMarketingCabinetChatHistory';
import {
	marketingCabinetAiRunsProjectInvalidationQueryKey,
	marketingCabinetChatHistoryQueryKey,
} from '../marketingCabinetQueryOptions';

function isChatStreamAborted(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const e = error as { name?: string; message?: string };
	return e.name === 'AbortError' || e.message === 'Aborted';
}

export function useMarketingCabinetChatController({
	activeView,
	selectedProjectId,
	selectedCompanyId,
	projects,
}: {
	activeView: MarketingView;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	projects: MarketingProject[];
}) {
	const { t } = useTranslation('marketing');
	const queryClient = useQueryClient();
	const chatAbortRef = useRef<AbortController | null>(null);
	const readOnlyMarketing = Boolean(
		projects.find((p) => p.id === selectedProjectId)?.read_only_marketing
	);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [chatSessionReset, setChatSessionReset] = useState(false);
	const [chatDraft, setChatDraft] = useState('');
	const [chatMessages, setChatMessages] = useState<ChatTimelineMessage[]>([]);

	useEffect(() => {
		return () => {
			chatAbortRef.current?.abort();
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: props drive context reset when company/project changes
	useEffect(() => {
		chatAbortRef.current?.abort();
		chatAbortRef.current = null;
		setConversationId(null);
		setChatMessages([]);
		setChatDraft('');
		setChatSessionReset(false);
	}, [selectedProjectId, selectedCompanyId]);

	useEffect(() => {
		if (activeView !== 'chat') {
			chatAbortRef.current?.abort();
			chatAbortRef.current = null;
		}
	}, [activeView]);

	useMarketingCabinetChatHistory({
		activeView,
		selectedProjectId,
		selectedCompanyId,
		chatSessionReset,
		setConversationId,
		setChatMessages,
	});

	const sendChatMutation = useMutation({
		mutationFn: (message: string) => {
			chatAbortRef.current?.abort();
			const controller = new AbortController();
			chatAbortRef.current = controller;
			return streamMarketingChatMessage(
				{
					message,
					company_id: selectedCompanyId,
					project_id: selectedProjectId,
					conversation_id: conversationId,
					...marketingWebSearchApiFields(readStoredMarketingWebSearchQuality()),
				},
				(event) => {
					if (
						event.event === 'started' &&
						typeof event.data.conversation_id === 'string'
					) {
						setChatSessionReset(false);
						setConversationId(event.data.conversation_id);
					}
				},
				controller.signal
			);
		},
		retry: (failureCount, error) => {
			if (isChatStreamAborted(error)) return false;
			const status = (error as { response?: { status?: number } })?.response
				?.status;
			if (status === 429) return false;
			return failureCount < 2;
		},
		retryDelay: 1500,
		onSuccess: (response: MarketingChatResponse) => {
			setChatSessionReset(false);
			setConversationId(response.conversation_id);
			setChatMessages((prev) => [...prev, response.message]);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetChatHistoryQueryKey(
					selectedProjectId,
					selectedCompanyId
				),
			});
		},
		onError: (error) => {
			if (isChatStreamAborted(error)) return;
			cabinetNotify.error(
				extractApiErrorMessage(error, t('cabinetPage.notices.chatSendFailed'))
			);
		},
	});

	const sendToolAgentChatMutation = useMutation({
		mutationFn: (input: { message: string; excerpt: string }) => {
			if (!selectedProjectId) {
				return Promise.reject(new Error('project required'));
			}
			return marketingCabinetApi.runToolAgent({
				prompt: input.message,
				project_id: selectedProjectId,
				chat_context_excerpt: input.excerpt || undefined,
				source: 'chat',
			});
		},
		onSuccess: (response: MarketingToolAgentResponse) => {
			setChatSessionReset(false);
			setChatMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: response.output_text,
				},
			]);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(
					requireDefined(selectedProjectId, 'selectedProjectId')
				),
			});
		},
		onError: (error) =>
			cabinetNotify.error(
				extractApiErrorMessage(
					error,
					t('cabinetPage.notices.toolAgentChatFailed')
				)
			),
	});

	const handleSendChatMessage = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			const message = chatDraft.trim();
			if (!message) return;
			if (readOnlyMarketing) {
				cabinetNotify.info(
					t('cabinetPage.readOnlyMarketing.chatBlocked', {
						defaultValue:
							'Режим только просмотра: чат с ассистентом недоступен.',
					})
				);
				return;
			}
			if (!selectedCompanyId && !selectedProjectId) {
				cabinetNotify.error(t('cabinetPage.validation.chatContextRequired'));
				return;
			}
			const userMessage: ChatTimelineMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: message,
			};
			setChatMessages((prev) => [...prev, userMessage]);
			setChatDraft('');
			try {
				await sendChatMutation.mutateAsync(message);
			} catch (error) {
				if (isChatStreamAborted(error)) return;
				throw error;
			}
		},
		[
			chatDraft,
			readOnlyMarketing,
			selectedCompanyId,
			selectedProjectId,
			sendChatMutation,
			t,
		]
	);

	const handleSendToolAgentMessage = useCallback(
		async (event: React.FormEvent) => {
			event.preventDefault();
			const message = chatDraft.trim();
			if (!message) return;
			if (readOnlyMarketing) {
				cabinetNotify.info(
					t('cabinetPage.readOnlyMarketing.chatBlocked', {
						defaultValue:
							'Режим только просмотра: чат с ассистентом недоступен.',
					})
				);
				return;
			}
			if (!selectedProjectId) {
				cabinetNotify.info(t('cabinetPage.validation.toolAgentNeedsProject'));
				return;
			}
			if (!selectedCompanyId && !selectedProjectId) {
				cabinetNotify.error(t('cabinetPage.validation.chatContextRequired'));
				return;
			}
			const excerpt = buildMarketingChatExcerpt(chatMessages, 3500, {
				user: t('chatView.excerptRoleUser'),
				assistant: t('chatView.excerptRoleOracle'),
			});
			const userMessage: ChatTimelineMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: message,
			};
			setChatMessages((prev) => [...prev, userMessage]);
			setChatDraft('');
			await sendToolAgentChatMutation.mutateAsync({ message, excerpt });
		},
		[
			chatDraft,
			chatMessages,
			readOnlyMarketing,
			selectedCompanyId,
			selectedProjectId,
			sendToolAgentChatMutation,
			t,
		]
	);

	const clearChatSession = useCallback(() => {
		chatAbortRef.current?.abort();
		chatAbortRef.current = null;
		setChatSessionReset(true);
		setConversationId(null);
		setChatMessages([]);
		setChatDraft('');
		queryClient.removeQueries({
			queryKey: marketingCabinetChatHistoryQueryKey(
				selectedProjectId,
				selectedCompanyId
			),
		});
	}, [queryClient, selectedCompanyId, selectedProjectId]);

	return {
		chatDraft,
		setChatDraft,
		chatMessages,
		sendChatMutation,
		sendToolAgentChatMutation,
		handleSendChatMessage,
		handleSendToolAgentMessage,
		clearChatSession,
	};
}
