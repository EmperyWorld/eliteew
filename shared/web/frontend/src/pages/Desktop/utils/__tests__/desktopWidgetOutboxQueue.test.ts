/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave B outbox contract: retain ops + Idempotency-Key on 500 / network abort;
 * clear only after 2xx.
 *
 * Related:
 * - utils/desktopWidgetOutboxQueue.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_WIDGET_OUTBOX_STORAGE_KEY,
	clearDesktopWidgetOutbox,
	enqueueDesktopWidgetOutboxOp,
	flushDesktopWidgetOutbox,
	getDesktopWidgetOutboxCount,
	peekDesktopWidgetOutbox,
} from '../desktopWidgetOutboxQueue';

describe('desktopWidgetOutboxQueue', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		clearDesktopWidgetOutbox();
	});

	it('retains outbox and Idempotency-Key when batch flush returns 500', async () => {
		const subject = 'user-wave-b';
		enqueueDesktopWidgetOutboxOp(subject, {
			kind: 'note_create',
			client_id: 'note-1',
			payload: { content: 'offline' },
		});
		expect(getDesktopWidgetOutboxCount(subject)).toBe(1);

		const syncBatch = vi.fn<
			(args: { idempotencyKey?: string }) => Promise<unknown>
		>(async () => {
			throw new Error('HTTP 500 widget-sync apply failed');
		});

		const first = await flushDesktopWidgetOutbox({ subject, syncBatch });
		expect(first.ok).toBe(false);
		expect(first.syncError).toBe(true);
		expect(getDesktopWidgetOutboxCount(subject)).toBe(1);

		const env = peekDesktopWidgetOutbox(subject);
		expect(env?.ops).toHaveLength(1);
		expect(env?.inflightIdempotencyKey).toBeTruthy();
		const key = env?.inflightIdempotencyKey;

		const second = await flushDesktopWidgetOutbox({ subject, syncBatch });
		expect(second.syncError).toBe(true);
		expect(syncBatch).toHaveBeenCalledTimes(2);
		expect(syncBatch.mock.calls[0]?.[0]?.idempotencyKey).toBe(key);
		expect(syncBatch.mock.calls[1]?.[0]?.idempotencyKey).toBe(key);
		expect(
			localStorage.getItem(DESKTOP_WIDGET_OUTBOX_STORAGE_KEY)
		).toBeTruthy();
	});

	it('clears outbox only after successful 2xx sync', async () => {
		const subject = 'user-ok';
		enqueueDesktopWidgetOutboxOp(subject, {
			kind: 'todo_create',
			client_id: 'todo-1',
			payload: { text: 'x' },
		});
		const syncBatch = vi.fn(async () => ({ results: [] }));
		const result = await flushDesktopWidgetOutbox({ subject, syncBatch });
		expect(result.ok).toBe(true);
		expect(result.syncError).toBe(false);
		expect(getDesktopWidgetOutboxCount(subject)).toBe(0);
		expect(localStorage.getItem(DESKTOP_WIDGET_OUTBOX_STORAGE_KEY)).toBeNull();
	});
});
