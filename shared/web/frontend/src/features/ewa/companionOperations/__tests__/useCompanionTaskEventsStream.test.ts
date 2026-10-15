/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression locks for companion task-run SSE lifecycle. Prevents normal-close
 * streams from reconnecting in a tight React update loop.
 *
 * Invariants:
 * - Per-run terminal snapshots close the scoped stream once.
 * - Successful stream close waits before reconnecting.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionTaskEventsStream.ts
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import { useCompanionTaskEventsStream } from '@/features/ewa/companionOperations/useCompanionTaskEventsStream';
import {
	streamEwaCompanionTaskEvents,
	streamEwaCompanionTaskRunEvents,
} from '@/services/ewa/ewaCompanionChatApi';

vi.mock('@/services/ewa/ewaCompanionChatApi', () => ({
	streamEwaCompanionTaskEvents: vi.fn(async () => undefined),
	streamEwaCompanionTaskRunEvents: vi.fn(async () => undefined),
}));

function waitForMicrotaskTurn(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 25));
}

describe('useCompanionTaskEventsStream', () => {
	beforeEach(() => {
		useCompanionOperationsStore.getState().reset();
		vi.clearAllMocks();
	});

	afterEach(() => {
		useCompanionOperationsStore.getState().reset();
	});

	it('does not immediately reconnect after a successful global stream close', async () => {
		const { unmount } = renderHook(() =>
			useCompanionTaskEventsStream(true, '', {})
		);

		await waitFor(() => {
			expect(streamEwaCompanionTaskEvents).toHaveBeenCalledTimes(1);
		});
		await waitForMicrotaskTurn();

		expect(streamEwaCompanionTaskEvents).toHaveBeenCalledTimes(1);
		expect(streamEwaCompanionTaskRunEvents).not.toHaveBeenCalled();

		unmount();
	});

	it('closes a scoped per-run stream when connect snapshot is already terminal', async () => {
		useCompanionOperationsStore.getState().setOperationRuns([
			makeCompanionTaskRun({
				id: 'run-1',
				status: 'running',
				run_revision: 1,
			}),
		]);
		const onTerminal = vi.fn();
		vi.mocked(streamEwaCompanionTaskRunEvents).mockImplementation(
			async (_runId, handlers) => {
				handlers.onRunSnapshot?.(
					makeCompanionTaskRun({
						id: 'run-1',
						status: 'completed',
						run_revision: 2,
					})
				);
			}
		);

		const { unmount } = renderHook(() =>
			useCompanionTaskEventsStream(true, 'run-1', { onTerminal })
		);

		await waitFor(() => {
			expect(streamEwaCompanionTaskRunEvents).toHaveBeenCalledTimes(1);
		});
		await waitForMicrotaskTurn();

		expect(streamEwaCompanionTaskRunEvents).toHaveBeenCalledTimes(1);
		expect(onTerminal).toHaveBeenCalledTimes(1);
		expect(
			useCompanionOperationsStore.getState().operationRuns[0]
		).toMatchObject({
			id: 'run-1',
			status: 'completed',
			run_revision: 2,
		});

		unmount();
	});

	it('does not immediate-reconnect-storm after rapid activeRunIdsKey churn', async () => {
		vi.mocked(streamEwaCompanionTaskRunEvents).mockImplementation(
			async () => undefined
		);
		vi.mocked(streamEwaCompanionTaskEvents).mockImplementation(
			async () => undefined
		);

		const { rerender, unmount } = renderHook(
			({ key }: { key: string }) => useCompanionTaskEventsStream(true, key, {}),
			{ initialProps: { key: 'run-a' } }
		);

		await waitFor(() => {
			expect(streamEwaCompanionTaskRunEvents).toHaveBeenCalled();
		});

		const keys = ['run-b', 'run-a', 'run-c', 'run-b', 'run-a'];
		for (const key of keys) {
			rerender({ key });
		}

		await waitForMicrotaskTurn();
		const scopedCalls = vi.mocked(streamEwaCompanionTaskRunEvents).mock.calls
			.length;
		const globalCalls = vi.mocked(streamEwaCompanionTaskEvents).mock.calls
			.length;
		const settledTotal = scopedCalls + globalCalls;

		// Effect remounts per key — bounded by flips, not unbounded microtask reconnect.
		expect(settledTotal).toBeLessThanOrEqual(keys.length + 2);
		await waitForMicrotaskTurn();
		await waitForMicrotaskTurn();
		expect(
			vi.mocked(streamEwaCompanionTaskRunEvents).mock.calls.length +
				vi.mocked(streamEwaCompanionTaskEvents).mock.calls.length
		).toBe(settledTotal);

		unmount();
	});
});
