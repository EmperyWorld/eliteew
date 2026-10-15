/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side performance marks for Desktop AI Chat SSE streams (TTFT, done).
 *
 * Invariants:
 * - Marks are best-effort; missing performance API is a no-op.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts, __tests__/fixtures/desktop_ai_chat_stream_perf_baseline.json
 * ---
 */

export type DesktopAiChatStreamMetricsSnapshot = {
	streamFetchStartMs: number | null;
	firstSseChunkMs: number | null;
	doneEventMs: number | null;
};

const MARK_FETCH = 'desktop-ai-chat-stream-fetch-start';
const MARK_FIRST = 'desktop-ai-chat-stream-first-chunk';
const MARK_DONE = 'desktop-ai-chat-stream-done';

function perfAvailable(): boolean {
	return (
		typeof performance !== 'undefined' && typeof performance.mark === 'function'
	);
}

export function markDesktopAiChatStreamFetchStart(): void {
	if (!perfAvailable()) {
		return;
	}
	try {
		performance.mark(MARK_FETCH);
	} catch {
		/* ignore duplicate marks */
	}
}

export function markDesktopAiChatStreamFirstChunk(): void {
	if (!perfAvailable()) {
		return;
	}
	try {
		performance.mark(MARK_FIRST);
	} catch {
		/* ignore */
	}
}

export function markDesktopAiChatStreamDone(): DesktopAiChatStreamMetricsSnapshot {
	if (!perfAvailable()) {
		return {
			streamFetchStartMs: null,
			firstSseChunkMs: null,
			doneEventMs: null,
		};
	}
	try {
		performance.mark(MARK_DONE);
	} catch {
		/* ignore */
	}
	return readDesktopAiChatStreamMetrics();
}

export function clearDesktopAiChatStreamMetrics(): void {
	if (!perfAvailable() || typeof performance.clearMarks !== 'function') {
		return;
	}
	for (const name of [MARK_FETCH, MARK_FIRST, MARK_DONE]) {
		try {
			performance.clearMarks(name);
		} catch {
			/* ignore */
		}
	}
}

export function readDesktopAiChatStreamMetrics(): DesktopAiChatStreamMetricsSnapshot {
	if (!perfAvailable()) {
		return {
			streamFetchStartMs: null,
			firstSseChunkMs: null,
			doneEventMs: null,
		};
	}
	const fetchStart = performance.getEntriesByName(MARK_FETCH, 'mark').at(-1);
	const firstChunk = performance.getEntriesByName(MARK_FIRST, 'mark').at(-1);
	const done = performance.getEntriesByName(MARK_DONE, 'mark').at(-1);
	const origin = fetchStart?.startTime ?? 0;
	return {
		streamFetchStartMs: fetchStart ? fetchStart.startTime : null,
		firstSseChunkMs:
			firstChunk && origin
				? Math.max(0, firstChunk.startTime - origin)
				: firstChunk
					? firstChunk.startTime
					: null,
		doneEventMs:
			done && origin
				? Math.max(0, done.startTime - origin)
				: done
					? done.startTime
					: null,
	};
}
