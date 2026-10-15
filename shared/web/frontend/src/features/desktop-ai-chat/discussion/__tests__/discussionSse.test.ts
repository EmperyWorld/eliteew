/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSE frame parser and body reader for Discussion events (no client mock).
 *
 * Related:
 * - ../discussionSse.ts
 */
import { describe, expect, it, vi } from 'vitest';
import {
	assertDiscussionSseHttp,
	discussionSseEventRequiresRefresh,
	parseDiscussionSseBlock,
	readDiscussionSseBody,
} from '../discussionSse';

function streamFrom(text: string): ReadableStream<Uint8Array> {
	const bytes = new TextEncoder().encode(text);
	return new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

describe('parseDiscussionSseBlock', () => {
	it('ignores keep-alive comments', () => {
		expect(parseDiscussionSseBlock(': keep-alive')).toBeNull();
		expect(discussionSseEventRequiresRefresh('keepalive')).toBe(false);
		expect(discussionSseEventRequiresRefresh('message')).toBe(false);
	});

	it('parses Redis event frames and requires a session refresh', () => {
		const frame = parseDiscussionSseBlock(
			'id: 1-0\nevent: council_turn\ndata: {"status":"running"}'
		);
		expect(frame).toEqual({
			id: '1-0',
			event: 'council_turn',
			data: { status: 'running' },
		});
		expect(discussionSseEventRequiresRefresh('council_turn')).toBe(true);
		expect(discussionSseEventRequiresRefresh('discussion_session')).toBe(true);
	});
});

describe('readDiscussionSseBody / assertDiscussionSseHttp', () => {
	it('skips keep-alive comments and emits named frames', async () => {
		const body = [
			': keep-alive\n\n',
			'id: 2-0\nevent: discussion_session\ndata: {"status":"running"}\n\n',
		].join('');
		const onFrame = vi.fn();
		await readDiscussionSseBody(streamFrom(body), onFrame);
		expect(onFrame).toHaveBeenCalledTimes(1);
		expect(onFrame.mock.calls[0]?.[0]).toMatchObject({
			id: '2-0',
			event: 'discussion_session',
		});
	});

	it('throws on non-OK HTTP so the hook can degrade to poll', () => {
		expect(() =>
			assertDiscussionSseHttp(new Response('', { status: 503 }))
		).toThrow(/discussion_events_http_503/);
	});
});
