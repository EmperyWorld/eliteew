import { describe, expect, it } from 'vitest';
import { formatDesktopAiContextSummaryLine } from '../desktopChatContextSummary';
import {
	extractDoneStreamContext,
	findLastDoneContextFromSse,
	parseDesktopAiSseDataPayloads,
} from '../desktopChatSsePayload';
import type { TFunction } from 'i18next';

const t = ((key: string, opts?: Record<string, unknown>) => {
	switch (key) {
		case 'contextRagChunks':
			return `rag:${opts?.count ?? 0}`;
		case 'contextRagSources':
			return `rag-src:${opts?.count ?? 0}`;
		case 'contextPolicyApplied':
			return 'policy:on';
		case 'contextSummaryPrefix':
			return `CTX(${opts?.parts ?? ''})`;
		default:
			return key;
	}
}) as TFunction<'desktopAiChat'>;

const SAMPLE_SSE = [
	': keep-alive',
	'',
	'data: {"event":"token","delta":"hi"}',
	'',
	'data: {"event":"done","context":{"chat_rag_chunks":2,"chat_rag_quality":{"unique_content_ids":1},"context_policy_applied":true},"duration_ms":120}',
	'',
].join('\n');

describe('parseDesktopAiSseDataPayloads', () => {
	it('parses data lines and skips keep-alive comments', () => {
		const events = parseDesktopAiSseDataPayloads(SAMPLE_SSE);
		expect(events).toHaveLength(2);
		expect(events[0]?.event).toBe('token');
		expect(events[1]?.event).toBe('done');
	});
});

describe('extractDoneStreamContext', () => {
	it('returns null for non-object payloads', () => {
		expect(extractDoneStreamContext(null)).toBeNull();
		expect(extractDoneStreamContext({ event: 'done' })).toBeNull();
	});

	it('extracts context object from done payload', () => {
		const ctx = extractDoneStreamContext({
			event: 'done',
			context: { chat_rag_chunks: 3, context_policy_applied: true },
		});
		expect(ctx?.chat_rag_chunks).toBe(3);
		expect(ctx?.context_policy_applied).toBe(true);
	});
});

describe('findLastDoneContextFromSse', () => {
	it('finds context from the last done event in SSE text', () => {
		const ctx = findLastDoneContextFromSse(SAMPLE_SSE);
		expect(ctx?.chat_rag_chunks).toBe(2);
		expect(ctx?.chat_rag_quality?.unique_content_ids).toBe(1);
	});

	it('formats footer line via context summary helper', () => {
		const ctx = findLastDoneContextFromSse(SAMPLE_SSE);
		const line = formatDesktopAiContextSummaryLine(ctx ?? undefined, t);
		expect(line).toBe('CTX(rag:2; rag-src:1; policy:on)');
	});
});
