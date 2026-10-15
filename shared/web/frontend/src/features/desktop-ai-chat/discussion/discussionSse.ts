/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated Discussion events SSE (GET …/events). Native EventSource
 * cannot send Bearer; use apiFetchWithAuth like other Desktop streams.
 *
 * Invariants:
 * - Keep-alive comments are not session refreshes.
 * - Named Redis events require a PG GET refresh (PG is SoT).
 * - Natural stream end (proxy/server EOF) is `discussion_events_eof`, not success.
 *
 * Related:
 * - discussion/api.ts discussionEventsUrl
 * - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
 */
import { apiFetchWithAuth } from '@/services/api/client';

export type DiscussionSseFrame = {
	id: string | null;
	event: string;
	data: unknown;
};

export function parseDiscussionSseBlock(
	block: string
): DiscussionSseFrame | null {
	let id: string | null = null;
	let event = 'message';
	const dataLines: string[] = [];
	for (const rawLine of block.split('\n')) {
		const line = rawLine.trimEnd();
		if (!line || line.startsWith(':')) continue;
		if (line.startsWith('id:')) {
			id = line.slice(3).trim();
			continue;
		}
		if (line.startsWith('event:')) {
			event = line.slice(6).trim();
			continue;
		}
		if (line.startsWith('data:')) {
			dataLines.push(line.slice(5).trimStart());
		}
	}
	if (dataLines.length === 0 && event === 'message' && id == null) {
		return null;
	}
	if (dataLines.length === 0) {
		return { id, event, data: null };
	}
	const raw = dataLines.join('\n');
	try {
		return { id, event, data: JSON.parse(raw) as unknown };
	} catch {
		return { id, event, data: raw };
	}
}

export function discussionSseEventRequiresRefresh(eventName: string): boolean {
	const name = eventName.trim();
	if (!name || name === 'keepalive' || name === 'message') return false;
	return true;
}

export function assertDiscussionSseHttp(res: Response): void {
	if (!res.ok || !res.body) {
		throw new Error(`discussion_events_http_${res.status || 0}`);
	}
}

export async function readDiscussionSseBody(
	body: ReadableStream<Uint8Array>,
	onFrame: (frame: DiscussionSseFrame) => void
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const parts = buffer.split('\n\n');
		buffer = parts.pop() ?? '';
		for (const block of parts) {
			const frame = parseDiscussionSseBlock(block);
			if (frame) onFrame(frame);
		}
	}
}

export async function consumeDiscussionEventStream(params: {
	url: string;
	signal?: AbortSignal;
	onOpen?: () => void;
	onFrame: (frame: DiscussionSseFrame) => void;
}): Promise<void> {
	const res = await apiFetchWithAuth(params.url, {
		method: 'GET',
		headers: { Accept: 'text/event-stream' },
		credentials: 'include',
		signal: params.signal,
	});
	assertDiscussionSseHttp(res);
	params.onOpen?.();
	if (!res.body) {
		throw new Error('discussion_events_http_0');
	}
	await readDiscussionSseBody(res.body, params.onFrame);
	if (params.signal?.aborted) return;
	throw new Error('discussion_events_eof');
}
