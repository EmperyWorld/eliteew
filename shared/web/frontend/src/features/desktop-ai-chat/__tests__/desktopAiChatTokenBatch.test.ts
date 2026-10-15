/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock rAF token coalescing for Desktop AI Chat stream paints.
 *
 * Invariants:
 * - Multiple schedule calls before a frame produce a single flush.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopAiChatTokenBatch.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDesktopAiChatTokenBatch } from '../desktopAiChatTokenBatch';

describe('createDesktopAiChatTokenBatch', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('coalesces multiple schedule calls into one rAF flush', () => {
		const callbacks: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			callbacks.push(cb);
			return callbacks.length;
		});
		vi.stubGlobal('cancelAnimationFrame', vi.fn());

		const batch = createDesktopAiChatTokenBatch();
		const flush = vi.fn();
		batch.schedule(flush);
		batch.schedule(flush);
		batch.schedule(flush);
		expect(flush).not.toHaveBeenCalled();
		expect(callbacks).toHaveLength(1);
		callbacks[0]?.(0);
		expect(flush).toHaveBeenCalledTimes(1);
	});

	it('flushNow runs the latest pending work immediately', () => {
		vi.stubGlobal('requestAnimationFrame', () => 1);
		vi.stubGlobal('cancelAnimationFrame', vi.fn());

		const batch = createDesktopAiChatTokenBatch();
		const first = vi.fn();
		const second = vi.fn();
		batch.schedule(first);
		batch.schedule(second);
		batch.flushNow();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('cancel drops pending work without running it', () => {
		vi.stubGlobal('requestAnimationFrame', () => 1);
		const cancel = vi.fn();
		vi.stubGlobal('cancelAnimationFrame', cancel);

		const batch = createDesktopAiChatTokenBatch();
		const flush = vi.fn();
		batch.schedule(flush);
		batch.cancel();
		expect(flush).not.toHaveBeenCalled();
		expect(cancel).toHaveBeenCalled();
	});
});
