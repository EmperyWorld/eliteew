/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for automatic shell_state conflict rehydration via mutation pipeline.
 *
 * Invariants:
 * - The hook attempts recovery once per conflict episode and resets when pipeline idle.
 * - Failed auto-recover surfaces a failed phase without silent retry loops.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopStaleShellStateAutoRecover.ts
 * ---
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	getStaleShellAutoRecoverDiagnostics,
	getStaleShellAutoRecoverSnapshot,
	resetStaleShellAutoRecoverUiForTests,
	useDesktopStaleShellStateAutoRecover,
} from '../useDesktopStaleShellStateAutoRecover';

const pipelineSnapshot = vi.hoisted(() => ({
	phase: 'idle' as
		| 'idle'
		| 'conflict'
		| 'debouncing'
		| 'flushing'
		| 'recovering',
	lastConflict: null as { message: string } | null,
	pendingSources: [] as string[],
	etag: null as string | null,
}));

const pipelineListeners = vi.hoisted(() => {
	const listeners = new Set<(snapshot: typeof pipelineSnapshot) => void>();
	return {
		listeners,
		emit() {
			for (const listener of listeners) {
				listener(pipelineSnapshot);
			}
		},
	};
});

const resolveShellStateConflict = vi.hoisted(() =>
	vi.fn(async () => undefined)
);

vi.mock('../../utils/desktopShellStateMutationPipeline', () => ({
	subscribeShellStatePipeline: vi.fn((listener) => {
		pipelineListeners.listeners.add(listener);
		listener(pipelineSnapshot);
		return () => {
			pipelineListeners.listeners.delete(listener);
		};
	}),
	getShellStatePipelineSnapshot: vi.fn(() => pipelineSnapshot),
	resolveShellStateConflict,
}));

describe('useDesktopStaleShellStateAutoRecover', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetStaleShellAutoRecoverUiForTests();
		pipelineSnapshot.phase = 'idle';
		pipelineSnapshot.lastConflict = null;
		resolveShellStateConflict.mockClear();
		pipelineListeners.listeners.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
		resetStaleShellAutoRecoverUiForTests();
	});

	function emitPipelinePhase(
		phase: typeof pipelineSnapshot.phase,
		lastConflict: typeof pipelineSnapshot.lastConflict = null
	): void {
		pipelineSnapshot.phase = phase;
		pipelineSnapshot.lastConflict = lastConflict;
		pipelineListeners.emit();
	}

	it('attempts recovery once per conflict episode even when pipeline re-notifies conflict', async () => {
		renderHook(() => useDesktopStaleShellStateAutoRecover());

		emitPipelinePhase('conflict', { message: 'stale etag' });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);

		emitPipelinePhase('conflict', { message: 'still stale' });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);
	});

	it('does not reset attempted flag when pipeline passes through recovering', async () => {
		renderHook(() => useDesktopStaleShellStateAutoRecover());

		emitPipelinePhase('conflict', { message: 'stale etag' });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);

		emitPipelinePhase('recovering');
		emitPipelinePhase('conflict', { message: 'still stale after recover' });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);
	});

	it('resets the attempted flag after pipeline returns to idle', async () => {
		renderHook(() => useDesktopStaleShellStateAutoRecover());

		emitPipelinePhase('conflict', { message: 'stale etag' });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);

		emitPipelinePhase('idle');
		emitPipelinePhase('conflict', { message: 'stale etag again' });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(resolveShellStateConflict).toHaveBeenCalledTimes(2);
	});

	it('marks auto-recover failed when pipeline conflict remains after recover settles', async () => {
		renderHook(() => useDesktopStaleShellStateAutoRecover());

		emitPipelinePhase('conflict', { message: 'stale etag' });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});
		expect(getStaleShellAutoRecoverSnapshot().phase).toBe('attempting');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(32);
		});

		expect(resolveShellStateConflict).toHaveBeenCalledTimes(1);
		expect(getStaleShellAutoRecoverSnapshot().phase).toBe('failed');
		expect(getStaleShellAutoRecoverDiagnostics()).toMatchObject({
			phase: 'failed',
			lastFailedSignature: 'pipeline:conflict',
		});
	});

	it('clears failed phase when pipeline returns idle after recover', async () => {
		renderHook(() => useDesktopStaleShellStateAutoRecover());

		emitPipelinePhase('conflict', { message: 'stale etag' });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120);
		});

		emitPipelinePhase('idle');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(32);
		});

		expect(getStaleShellAutoRecoverSnapshot().phase).toBe('idle');
		expect(
			getStaleShellAutoRecoverDiagnostics().lastFailedSignature
		).toBeNull();
	});
});
