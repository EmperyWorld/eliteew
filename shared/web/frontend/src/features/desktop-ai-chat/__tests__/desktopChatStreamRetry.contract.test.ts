import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { streamDesktopAiChat } from '../api/desktopChatClient';

vi.mock('../../../services/authSession', () => ({
	default: {
		token: 'test-token',
		authenticated: false,
	},
	ensureAccessTokenMinValidity: vi.fn().mockResolvedValue(undefined),
}));

const SSE_DONE = 'data: {"event":"done"}\n\n';

function mockSseResponse(prefix = ''): Response {
	const body = new ReadableStream({
		start(controller) {
			const enc = new TextEncoder();
			if (prefix) {
				controller.enqueue(enc.encode(prefix));
			}
			controller.enqueue(enc.encode(SSE_DONE));
			controller.close();
		},
	});
	return new Response(body, { status: 200 });
}

describe('streamDesktopAiChat retry contract', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('retries once on retryable network failure then completes', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1;
				if (calls === 1) {
					throw new TypeError('Failed to fetch');
				}
				return mockSseResponse();
			})
		);

		const onToken = vi.fn();
		const promise = streamDesktopAiChat('chat-1', 'hello', false, onToken);
		await vi.advanceTimersByTimeAsync(700);
		await promise;

		expect(calls).toBe(2);
		expect(onToken).not.toHaveBeenCalled();
	});

	it('does not retry on non-retryable 409 conflict', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1;
				return new Response(
					JSON.stringify({ detail: 'duplicate_client_request' }),
					{
						status: 409,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			})
		);

		await expect(
			streamDesktopAiChat(
				'chat-1',
				'hello',
				false,
				vi.fn<(delta: string) => void>()
			)
		).rejects.toThrow(/409/);
		expect(calls).toBe(1);
	});

	it('does not retry when the stream was aborted', async () => {
		let calls = 0;
		const controller = new AbortController();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				calls += 1;
				if (calls === 1) {
					controller.abort();
					const err = new DOMException('Aborted', 'AbortError');
					throw err;
				}
				return mockSseResponse();
			})
		);

		const onToken = vi.fn<(delta: string) => void>();
		await expect(
			streamDesktopAiChat(
				'chat-1',
				'hello',
				false,
				onToken,
				undefined,
				controller.signal
			)
		).rejects.toMatchObject({ name: 'AbortError' });
		expect(calls).toBe(1);
	});

	it('sends client_request_id in the stream POST body', async () => {
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			const parsed = JSON.parse(String(init?.body)) as {
				client_request_id?: string;
				content?: string;
				use_web_search?: boolean;
			};
			expect(parsed.client_request_id).toBe('req-uuid-123');
			expect(parsed.content).toBe('payload');
			expect(parsed.use_web_search).toBe(true);
			return mockSseResponse('data: {"event":"token","delta":"x"}\n\n');
		});
		vi.stubGlobal('fetch', fetchMock);

		const onToken = vi.fn();
		await streamDesktopAiChat(
			'chat-1',
			'payload',
			true,
			true,
			onToken,
			undefined,
			undefined,
			{
				clientRequestId: 'req-uuid-123',
			}
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(onToken).toHaveBeenCalledWith('x');
	});
});
