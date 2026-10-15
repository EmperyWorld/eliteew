/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSE consumers for marketing-cabinet chat and AI assist streams (fetch + parse).
 *
 * Invariants:
 * - Optional AbortSignal cancels fetch and stream read (tab/context switch).
 *
 * Related:
 * - hooks/useMarketingCabinetChatController.ts
 */

import {
	apiFetchWithAuth,
	buildQueryString,
} from '../../../services/api/client';

import type {
	MarketingAiAssistPayload,
	MarketingAiStreamEvent,
	MarketingChatPayload,
	MarketingChatResponse,
} from './marketingCabinetApiStream.types';

async function consumeMarketingEventStream(
	path: string,
	payload: Record<string, unknown>,
	onEvent: (event: MarketingAiStreamEvent) => void,
	errorPrefix: string,
	signal?: AbortSignal
): Promise<void> {
	const qs = buildQueryString({});
	const response = await apiFetchWithAuth(`${path}${qs}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal,
	});
	if (!response.ok || !response.body) {
		const error = new Error(`${errorPrefix}: ${response.status}`) as Error & {
			response?: { status?: number };
		};
		error.response = { status: response.status };
		throw error;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let currentEvent = 'message';

	while (true) {
		if (signal?.aborted) {
			await reader.cancel().catch(() => undefined);
			throw new DOMException('Aborted', 'AbortError');
		}
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const chunks = buffer.split('\n\n');
		buffer = chunks.pop() || '';

		for (const chunk of chunks) {
			const lines = chunk
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);
			let dataLine = '';
			currentEvent = 'message';
			for (const line of lines) {
				if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
				if (line.startsWith('data:')) dataLine += line.slice(5).trim();
			}
			if (!dataLine) continue;
			let data: Record<string, unknown>;
			try {
				data = JSON.parse(dataLine) as Record<string, unknown>;
			} catch {
				continue;
			}
			onEvent({
				event: currentEvent,
				data,
			});
		}
	}
}

/** Full URLs for marketing SSE POSTs (OpenAPI pilot + contract tests). */
export const MARKETING_CABINET_STREAM_AI_ASSIST_URL =
	'/api/v1/marketing-cabinet/ai/assist/stream' as const;
export const MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL =
	'/api/v1/marketing-cabinet/chat/message/stream' as const;

export async function streamMarketingAiAssist(
	payload: MarketingAiAssistPayload,
	onEvent: (event: MarketingAiStreamEvent) => void,
	signal?: AbortSignal
): Promise<void> {
	await consumeMarketingEventStream(
		MARKETING_CABINET_STREAM_AI_ASSIST_URL,
		{
			...payload,
			idempotency_key: payload.idempotency_key || crypto.randomUUID(),
		},
		onEvent,
		'AI stream failed',
		signal
	);
}

export async function streamMarketingChatMessage(
	payload: MarketingChatPayload,
	onEvent?: (event: MarketingAiStreamEvent) => void,
	signal?: AbortSignal
): Promise<MarketingChatResponse> {
	let finalResponse: MarketingChatResponse | null = null;
	let streamError: string | null = null;

	await consumeMarketingEventStream(
		MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL,
		{
			...payload,
			idempotency_key: payload.idempotency_key || crypto.randomUUID(),
		},
		(event) => {
			onEvent?.(event);
			if (event.event === 'result') {
				finalResponse = {
					conversation_id: String(event.data.conversation_id || ''),
					message: event.data.message as MarketingChatResponse['message'],
				};
			}
			if (event.event === 'error') {
				streamError = String(event.data.error || 'Chat stream failed');
			}
		},
		'Chat stream failed',
		signal
	);

	if (streamError) {
		throw new Error(streamError);
	}
	if (finalResponse === null) {
		throw new Error('Chat stream finished without result');
	}
	const { conversation_id: convId, message } = finalResponse;
	if (!convId || !message) {
		throw new Error('Chat stream finished without result');
	}
	return { conversation_id: convId, message };
}
