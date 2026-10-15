/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wire lock: running Discussion subscribes via fetch SSE; interval poll only
 * after SSE degrade. Native EventSource is not used (no Bearer).
 *
 * Related:
 * - ../useDiscussionSession.ts
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCUSSION_LIVE_POLL_INTERVAL_MS } from '../discussionLiveTransport';
import { consumeDiscussionEventStream } from '../discussionSse';
import { getDiscussion } from '../api';
import type { DiscussionSession } from '../types';
import { useDiscussionSession } from '../useDiscussionSession';

const { consumeMock, getDiscussionMock } = vi.hoisted(() => ({
	consumeMock: vi.fn(),
	getDiscussionMock: vi.fn(),
}));

vi.mock('../discussionSse', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../discussionSse')>();
	return {
		...actual,
		consumeDiscussionEventStream: consumeMock,
	};
});

vi.mock('../api', () => ({
	cancelDiscussion: vi.fn(),
	continueDiscussion: vi.fn(),
	fetchDiscussionParticipantProfile: vi.fn(async () => ({
		display_name: '',
		role_title: '',
		default_role_title: 'инкогнито',
	})),
	finishDiscussion: vi.fn(),
	generateDiscussionDocument: vi.fn(),
	getDiscussion: getDiscussionMock,
	listDiscussionPresets: vi.fn(async () => []),
	postDiscussionInterjection: vi.fn(),
	raiseDiscussionHand: vi.fn(),
	startDiscussion: vi.fn(),
	discussionEventsUrl: (chatId: string, sessionId: string, lastId = '0-0') =>
		`/api/v1/desktop/ai-chat/chats/${chatId}/discussion/${sessionId}/events?last_id=${lastId}`,
}));

const runningSession: DiscussionSession = {
	id: 'disc-run',
	chat_id: 'chat-1',
	owner_user_id: 'u1',
	preset_id: 'brainstorm',
	topic: 'Тема',
	goal: '',
	roster: ['h1', 'h2'],
	intensity: 'calm',
	status: 'running',
	version: 1,
	total_ai_turns: 1,
	checkpoint_ai_turns: 1,
	segment_index: 0,
	pause_requested: false,
	document_markdown: null,
	document_stale: false,
	participant_display_name: 'User',
	participant_role_title: 'инкогнито',
	turns: [],
};

function hangUntilAbort(signal?: AbortSignal): Promise<void> {
	return new Promise((_, reject) => {
		const fail = () => {
			const err = new Error('aborted');
			err.name = 'AbortError';
			reject(err);
		};
		if (signal?.aborted) {
			fail();
			return;
		}
		signal?.addEventListener('abort', fail, { once: true });
	});
}

describe('useDiscussionSession live transport', () => {
	let setIntervalSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consumeMock.mockReset();
		getDiscussionMock.mockReset();
		getDiscussionMock.mockResolvedValue(runningSession);
		setIntervalSpy = vi.spyOn(window, 'setInterval');
	});

	afterEach(() => {
		setIntervalSpy.mockRestore();
	});

	it('subscribes to events while running and does not start a 2.5s poll', async () => {
		consumeMock.mockImplementation(({ signal }: { signal?: AbortSignal }) =>
			hangUntilAbort(signal)
		);
		const { result, unmount } = renderHook(() =>
			useDiscussionSession('chat-1', [])
		);
		act(() => {
			result.current.bindSession(runningSession);
		});
		await waitFor(() => {
			expect(consumeDiscussionEventStream).toHaveBeenCalled();
		});
		expect(result.current.liveMode).toBe('sse');
		const pollCalls = setIntervalSpy.mock.calls.filter(
			(call) => call[1] === DISCUSSION_LIVE_POLL_INTERVAL_MS
		);
		expect(pollCalls).toHaveLength(0);
		unmount();
	});

	it('falls back to interval poll when SSE fails, and poll refresh is not swallowed', async () => {
		consumeMock.mockRejectedValue(new Error('discussion_events_http_503'));
		const { result, unmount } = renderHook(() =>
			useDiscussionSession('chat-1', [])
		);
		act(() => {
			result.current.bindSession(runningSession);
		});
		await waitFor(() => {
			expect(result.current.liveMode).toBe('poll');
		});
		const pollCalls = setIntervalSpy.mock.calls.filter(
			(call) => call[1] === DISCUSSION_LIVE_POLL_INTERVAL_MS
		);
		expect(pollCalls.length).toBeGreaterThan(0);
		const tick = pollCalls[0]?.[0] as () => void;
		await act(async () => {
			tick();
			await Promise.resolve();
		});
		expect(getDiscussion).toHaveBeenCalledWith('chat-1', 'disc-run');
		unmount();
	});

	it('stays idle (no SSE, no poll) when the session is paused', async () => {
		const paused: DiscussionSession = {
			...runningSession,
			status: 'paused_checkpoint',
		};
		const { result, unmount } = renderHook(() =>
			useDiscussionSession('chat-1', [])
		);
		act(() => {
			result.current.bindSession(paused);
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(result.current.liveMode).toBe('idle');
		expect(consumeDiscussionEventStream).not.toHaveBeenCalled();
		const pollCalls = setIntervalSpy.mock.calls.filter(
			(call) => call[1] === DISCUSSION_LIVE_POLL_INTERVAL_MS
		);
		expect(pollCalls).toHaveLength(0);
		unmount();
	});

	it('treats a clean SSE close as degrade and starts poll, not a 250ms healthy retry', async () => {
		consumeMock.mockImplementation(
			async ({ onOpen }: { onOpen?: () => void }) => {
				onOpen?.();
			}
		);
		const { result, unmount } = renderHook(() =>
			useDiscussionSession('chat-1', [])
		);
		act(() => {
			result.current.bindSession(runningSession);
		});
		await waitFor(() => {
			expect(result.current.liveMode).toBe('poll');
		});
		const pollCalls = setIntervalSpy.mock.calls.filter(
			(call) => call[1] === DISCUSSION_LIVE_POLL_INTERVAL_MS
		);
		expect(pollCalls.length).toBeGreaterThan(0);
		unmount();
	});

	it('drops an in-flight SSE refresh after the chat changes', async () => {
		let releaseGet: ((value: DiscussionSession) => void) | undefined;
		getDiscussionMock.mockImplementation(
			() =>
				new Promise<DiscussionSession>((resolve) => {
					releaseGet = resolve;
				})
		);
		consumeMock.mockImplementation(
			async ({
				onFrame,
				signal,
			}: {
				onFrame?: (frame: { id: string; event: string; data: unknown }) => void;
				signal?: AbortSignal;
			}) => {
				onFrame?.({
					id: '1-0',
					event: 'council_turn',
					data: { status: 'running' },
				});
				await hangUntilAbort(signal);
			}
		);
		const { result, rerender, unmount } = renderHook(
			({ chatId }: { chatId: string | null }) =>
				useDiscussionSession(chatId, []),
			{ initialProps: { chatId: 'chat-1' } }
		);
		act(() => {
			result.current.bindSession(runningSession);
		});
		await waitFor(() => {
			expect(getDiscussionMock).toHaveBeenCalledWith('chat-1', 'disc-run');
		});
		rerender({ chatId: 'chat-2' });
		await act(async () => {
			releaseGet?.(runningSession);
			await Promise.resolve();
		});
		expect(result.current.session).toBeNull();
		unmount();
	});
});
