/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for assistant SSE hook: stopStream, rate-limit FAQ ask, cache merge on done.
 *
 * Invariants:
 * - sendAssistantMessageStream is mocked; no network.
 *
 * Related:
 * - pages/Desktop/components/assistant/useAssistantMessageStream.ts
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef, createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantChatMessage } from '../../../services/productDesktopApi';
import { assistantMessagesQueryKey } from '../../assistantQueryOptions';
import { useAssistantMessageStream } from '../useAssistantMessageStream';

const sendAssistantMessageStream = vi.hoisted(() => vi.fn());
const listAssistantMessages = vi.hoisted(() => vi.fn());

vi.mock('../../../services/productDesktopApi', () => ({
	sendAssistantMessageStream,
	listAssistantMessages,
}));

vi.mock('sonner', () => ({
	toast: { error: vi.fn(), message: vi.fn() },
}));

const t = vi.fn((key: string, opts?: { seconds?: number }) =>
	opts?.seconds != null ? `${key}:${opts.seconds}` : key
) as unknown as Parameters<typeof useAssistantMessageStream>[0]['t'];

function createWrapper(qc: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: qc }, children);
	};
}

function baseHookArgs(qc: QueryClient, messages: AssistantChatMessage[] = []) {
	const inputRef = createRef<HTMLTextAreaElement>();
	const stickToBottomRef = { current: false };
	const setInput = vi.fn();
	const setNearBottom = vi.fn();
	return {
		qc,
		messages,
		t,
		inputRef,
		syncComposerHeight: vi.fn(),
		setInput,
		stickToBottomRef,
		setNearBottom,
	};
}

describe('useAssistantMessageStream', () => {
	let qc: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		listAssistantMessages.mockResolvedValue([]);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('stopStream restores composer text from pending send', async () => {
		sendAssistantMessageStream.mockImplementation(async () => {
			await new Promise(() => {
				/* hang until abort */
			});
		});

		const args = baseHookArgs(qc);
		const { result } = renderHook(() => useAssistantMessageStream(args), {
			wrapper: createWrapper(qc),
		});

		await act(async () => {
			void result.current.runSend('pending question');
		});

		expect(args.setInput).toHaveBeenCalledWith('');

		await act(() => {
			result.current.stopStream();
		});

		expect(args.setInput).toHaveBeenCalledWith('pending question');
		expect(result.current.sending).toBe(false);
		expect(result.current.pendingUserText).toBeNull();
	});

	it('rate limit disables FAQ ask and exposes wait title', async () => {
		vi.useFakeTimers();
		sendAssistantMessageStream.mockImplementation(async (_msg, handlers) => {
			handlers.onError('rate_limited', { retryAfterSeconds: 30 });
		});

		const args = baseHookArgs(qc);
		const { result } = renderHook(() => useAssistantMessageStream(args), {
			wrapper: createWrapper(qc),
		});

		await act(async () => {
			await result.current.runSend('rate limited question');
		});

		await act(async () => {
			vi.advanceTimersByTime(1000);
		});

		expect(result.current.faqAskDisabled).toBe(true);
		expect(result.current.faqAskDisabledTitle).toBe('rateLimitWait:29');
		expect(result.current.rateLimitSecondsLeft).toBeGreaterThan(0);
	});

	it('merges assistant message into query cache on done', async () => {
		const saved: AssistantChatMessage = {
			id: 'srv-a-1',
			role: 'assistant',
			content: 'Saved answer',
			created_at: '2026-01-02T00:00:00.000Z',
		};
		const existing: AssistantChatMessage = {
			id: 'srv-u-0',
			role: 'user',
			content: 'Old',
			created_at: '2026-01-01T00:00:00.000Z',
		};
		qc.setQueryData(assistantMessagesQueryKey(), [existing]);

		sendAssistantMessageStream.mockImplementation(async (msg, handlers) => {
			handlers.onDone(saved);
			expect(msg).toBe('new user question');
		});
		listAssistantMessages.mockResolvedValue([
			existing,
			{
				id: 'local-user-stub',
				role: 'user',
				content: 'new user question',
				created_at: saved.created_at,
			},
			saved,
		]);

		const args = baseHookArgs(qc, [existing]);
		const { result } = renderHook(() => useAssistantMessageStream(args), {
			wrapper: createWrapper(qc),
		});

		await act(async () => {
			await result.current.runSend('new user question');
		});

		await waitFor(() => {
			const cached = qc.getQueryData<AssistantChatMessage[]>(
				assistantMessagesQueryKey()
			);
			expect(cached?.some((m) => m.id === 'srv-a-1')).toBe(true);
			expect(cached?.some((m) => m.content === 'new user question')).toBe(true);
		});

		expect(result.current.streamingRaw).toBe('');
		expect(result.current.pendingUserText).toBeNull();
	});
});
