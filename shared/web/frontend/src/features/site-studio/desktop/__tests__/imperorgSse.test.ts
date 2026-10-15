/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Frontend regression tests for ImperorG SSE parsing and interrupted stream handling.
 *
 * Invariants:
 * - Malformed events are skipped without poisoning later terminal events.
 * - Stream EOF without terminal event is surfaced as an interrupted run.
 *
 * Related:
 * - ../api-imperorg.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetchWithAuth } from '@/services/api/client';
import { launchImperorG, parseImperorGSseBlock } from '../api-imperorg';

vi.mock('@/services/api/client', () => ({
	apiFetchWithAuth: vi.fn(),
}));

const mockedFetch = vi.mocked(apiFetchWithAuth);

function streamResponse(chunks: string[]): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
	return new Response(stream, { status: 200 });
}

describe('parseImperorGSseBlock', () => {
	it('supports comments, CRLF and multi-line data fields', () => {
		const parsed = parseImperorGSseBlock(
			': keep-alive\r\nevent: pipeline_complete\r\ndata: {"summary":\r\ndata: "ok"}'
		);

		expect(parsed).toEqual({
			event: 'pipeline_complete',
			data: '{"summary":\n"ok"}',
		});
	});
});

describe('launchImperorG SSE recovery', () => {
	beforeEach(() => {
		mockedFetch.mockReset();
	});

	it('flushes the final buffer when the stream ends without a trailing blank line', async () => {
		mockedFetch.mockResolvedValue(
			streamResponse(['event: pipeline_complete\ndata: {"summary":"ok"}'])
		);
		const onPipelineComplete = vi.fn();

		await launchImperorG({}, { onPipelineComplete });

		expect(onPipelineComplete).toHaveBeenCalledWith({ summary: 'ok' });
	});

	it('recovers from malformed events before a valid terminal event', async () => {
		mockedFetch.mockResolvedValue(
			streamResponse([
				'event: phase_step\ndata: {bad-json}\n\n',
				'event: pipeline_complete\ndata: {"summary":"recovered"}\n\n',
			])
		);
		const onPipelineComplete = vi.fn();

		await launchImperorG({}, { onPipelineComplete });

		expect(onPipelineComplete).toHaveBeenCalledWith({ summary: 'recovered' });
	});

	it('reports interrupted state when stream closes without explicit done', async () => {
		mockedFetch.mockResolvedValue(
			streamResponse(['event: phase_step\ndata: {"phase_id":"apply"}\n\n'])
		);
		const onPipelineError = vi.fn();

		await expect(launchImperorG({}, { onPipelineError })).rejects.toThrow(
			'stream ended before completion'
		);
		expect(onPipelineError).toHaveBeenCalledWith(
			expect.stringContaining('stream ended before completion')
		);
	});
});
