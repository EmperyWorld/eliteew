/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion SSE debounce buffer (stabilization patch).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	COMPANION_TASK_EVENTS_STREAM_DEBOUNCE_MS,
	createCompanionTaskEventsStreamBuffer,
} from '@/features/ewa/companionOperations/companionTaskEventsStreamBuffer';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';

describe('createCompanionTaskEventsStreamBuffer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('debounces multiple schedulers into one flush', () => {
		const onFlush = vi.fn();
		const buffer = createCompanionTaskEventsStreamBuffer(onFlush, 2000);
		const base = [
			makeCompanionTaskRun({ id: 'run-1', status: 'running', run_revision: 1 }),
		];

		buffer.schedule((prev) =>
			prev.map((r) => (r.id === 'run-1' ? { ...r, run_revision: 2 } : r))
		);
		buffer.schedule((prev) =>
			prev.map((r) =>
				r.id === 'run-1' ? { ...r, status: 'running', run_revision: 3 } : r
			)
		);

		expect(onFlush).not.toHaveBeenCalled();
		vi.advanceTimersByTime(COMPANION_TASK_EVENTS_STREAM_DEBOUNCE_MS - 1);
		expect(onFlush).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onFlush).toHaveBeenCalledTimes(1);
		const updater = onFlush.mock.calls[0]?.[0] as (
			prev: typeof base
		) => typeof base;
		const next = updater(base);
		expect(next[0]?.run_revision).toBe(3);

		buffer.dispose();
	});

	it('flushNow applies pending updater immediately', () => {
		const onFlush = vi.fn();
		const buffer = createCompanionTaskEventsStreamBuffer(onFlush, 2000);
		const base = [
			makeCompanionTaskRun({ id: 'run-1', status: 'queued', run_revision: 1 }),
		];

		buffer.schedule((prev) =>
			prev.map((r) => (r.id === 'run-1' ? { ...r, status: 'completed' } : r))
		);
		buffer.flushNow();

		expect(onFlush).toHaveBeenCalledTimes(1);
		const updater = onFlush.mock.calls[0]?.[0] as (
			prev: typeof base
		) => typeof base;
		expect(updater(base)[0]?.status).toBe('completed');

		vi.advanceTimersByTime(5000);
		expect(onFlush).toHaveBeenCalledTimes(1);
		buffer.dispose();
	});
});
