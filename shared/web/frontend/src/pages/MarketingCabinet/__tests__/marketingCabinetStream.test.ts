import { describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
}));

vi.mock('../../../services/api/client', async (importOriginal) => {
	const mod =
		await importOriginal<typeof import('../../../services/api/client')>();
	return {
		...mod,
		apiFetchWithAuth: fetchMock,
	};
});

function sseBody(chunks: string[]) {
	const encoder = new TextEncoder();
	const encoded = chunks.map((c) => encoder.encode(c));
	let i = 0;
	return {
		getReader: () => ({
			read: async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
				if (i >= encoded.length) {
					return { done: true, value: undefined };
				}
				return { done: false, value: encoded[i++] };
			},
		}),
	};
}

describe('streamMarketingChatMessage / streamMarketingAiAssist', () => {
	it('parses SSE result event and returns MarketingChatResponse', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			body: sseBody([
				'event: result\ndata: {"conversation_id":"conv-1","message":{"id":"m1","role":"assistant","content":"Hello"}}\n\n',
			]),
		});

		const { streamMarketingChatMessage } = await import(
			'../marketingCabinetApi'
		);
		const res = await streamMarketingChatMessage({
			message: 'hi',
			project_id: 'p1',
		});
		expect(res.conversation_id).toBe('conv-1');
		expect(res.message.content).toBe('Hello');
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/marketing-cabinet/chat/message/stream'),
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('throws when SSE sends error event', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			body: sseBody(['event: error\ndata: {"error":"rate limited"}\n\n']),
		});
		const { streamMarketingChatMessage } = await import(
			'../marketingCabinetApi'
		);
		await expect(streamMarketingChatMessage({ message: 'x' })).rejects.toThrow(
			'rate limited'
		);
	});

	it('forwards AbortSignal to apiFetchWithAuth', async () => {
		const controller = new AbortController();
		fetchMock.mockResolvedValueOnce({
			ok: true,
			body: sseBody([
				'event: result\ndata: {"conversation_id":"c1","message":{"id":"m1","role":"assistant","content":"ok"}}\n\n',
			]),
		});
		const { streamMarketingChatMessage } = await import(
			'../marketingCabinetApi'
		);
		await streamMarketingChatMessage(
			{ message: 'hi', project_id: 'p1' },
			undefined,
			controller.signal
		);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining('/marketing-cabinet/chat/message/stream'),
			expect.objectContaining({ signal: controller.signal })
		);
	});

	it('throws when stream ends without result', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			body: sseBody(['event: ping\ndata: {}\n\n']),
		});
		const { streamMarketingChatMessage } = await import(
			'../marketingCabinetApi'
		);
		await expect(streamMarketingChatMessage({ message: 'x' })).rejects.toThrow(
			'finished without result'
		);
	});

	it('streamMarketingAiAssist forwards events from SSE', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			body: sseBody([
				'event: token\ndata: {"t":"a"}\n\n',
				'event: done\ndata: {"ok":true}\n\n',
			]),
		});
		const { streamMarketingAiAssist } = await import('../marketingCabinetApi');
		const events: string[] = [];
		await streamMarketingAiAssist({ prompt: 'p', tool_key: 'tk' }, (e) => {
			events.push(e.event);
		});
		expect(events).toEqual(['token', 'done']);
	});

	it('slugify helpers', async () => {
		const { slugifyMarketingLabel, slugifyProjectSlug, slugifyCompanySlug } =
			await import('../marketingCabinetApi');
		expect(slugifyMarketingLabel('Hello World!')).toBe('hello-world');
		expect(slugifyProjectSlug('ab').length).toBeGreaterThanOrEqual(4);
		expect(slugifyCompanySlug('x').length).toBeGreaterThanOrEqual(2);
	});
});
