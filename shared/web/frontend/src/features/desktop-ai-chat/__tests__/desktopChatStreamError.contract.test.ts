import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DesktopAiSseTerminalError,
	classifyDesktopStreamError,
	formatDesktopStreamErrorBubble,
} from '../api/desktopChatClient';

describe('classifyDesktopStreamError', () => {
	it('treats SSE terminal errors as non-retryable', () => {
		const e = new DesktopAiSseTerminalError('nothing_to_regenerate');
		const c = classifyDesktopStreamError(e);
		expect(c.kind).toBe('sse');
		expect(c.retryable).toBe(false);
		expect(c.message).toContain('nothing_to_regenerate');
	});

	it('classifies 409 stream failures as non-retryable', () => {
		const c = classifyDesktopStreamError(
			new Error('Stream failed 409: duplicate_client_request')
		);
		expect(c.kind).toBe('http');
		expect(c.retryable).toBe(false);
		expect(c.canClearStreamLock).toBeFalsy();
	});

	it('flags turn_in_progress 409 as busy turn (soft recover)', () => {
		const c = classifyDesktopStreamError(
			new Error('Stream failed 409: turn_in_progress')
		);
		expect(c.kind).toBe('http');
		expect(c.retryable).toBe(false);
		expect(c.turnBusy).toBe(true);
		expect(c.canClearStreamLock).toBe(true);
	});

	it('maps 409 discussion_active to user copy without leaking the API detail', () => {
		const c = classifyDesktopStreamError(
			new Error('Stream failed 409: discussion_active')
		);
		expect(c.kind).toBe('http');
		expect(c.retryable).toBe(false);
		expect(c.turnBusy).toBeFalsy();
		expect(c.canClearStreamLock).toBeFalsy();
		expect(c.message.toLowerCase()).not.toContain('discussion_active');
		expect(c.message).not.toMatch(/^Stream failed/i);
		const bubble = formatDesktopStreamErrorBubble(
			c.message,
			(_key, opts) => `Error: ${opts.message}`
		);
		expect(bubble).toBe(`Error: ${c.message}`);
		expect(bubble.toLowerCase()).not.toContain('discussion_active');
		expect(bubble).not.toMatch(/Stream failed/i);
	});

	it('stream-run bubble interpolates classified message only', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../hooks/desktopAiChatStream/useDesktopAiChatStreamRun.ts'),
			'utf8'
		);
		expect(src).toContain('formatDesktopStreamErrorBubble(cls.message');
		expect(src).not.toMatch(/streamErrorInBubble[\s\S]{0,120}\braw\b/);
	});

	it('classifies confirm_expired 409 as non-retryable without stream-lock clear', () => {
		const c = classifyDesktopStreamError(
			new Error('Stream failed 409: confirm_expired')
		);
		expect(c.kind).toBe('http');
		expect(c.retryable).toBe(false);
		expect(c.canClearStreamLock).toBeFalsy();
	});

	it('marks 502/503/504 stream failures as retryable', () => {
		for (const code of ['502', '503', '504'] as const) {
			const c = classifyDesktopStreamError(
				new Error(`Stream failed ${code}: upstream unavailable`)
			);
			expect(c.kind).toBe('http');
			expect(c.retryable).toBe(true);
		}
	});
});
