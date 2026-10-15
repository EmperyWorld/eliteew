/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop persist-queue shell bridge via mutation pipeline.
 *
 * Invariants:
 * - Queue flush remains scoped to the authenticated subject and refreshes expansion state after shell patches.
 * - Persist conflict UI derives from pipeline snapshot, not local pause flags.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspacePersistQueue.ts
 * - src/pages/Desktop/utils/desktopShellStateMutationPipeline.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flushDesktopPersistPatchQueue = vi.hoisted(() => vi.fn());
const getDesktopPersistPatchQueueCounts = vi.hoisted(() => {
	const emptyCounts = { config: 0, shell: 0, total: 0 };
	return vi.fn(() => emptyCounts);
});
const scheduleShellStateMutation = vi.hoisted(() => vi.fn());
const flushShellStatePipelineNow = vi.hoisted(() => vi.fn());
const resolveShellStateConflict = vi.hoisted(() => vi.fn());

const pipelineListeners = vi.hoisted(() => new Set<() => void>());
const pipelineSnapshot = vi.hoisted(() => ({
	phase: 'idle' as 'idle' | 'flushing' | 'conflict',
	pendingSources: [] as Array<'persist' | 'expansion'>,
	lastConflict: null as Error | null,
}));

function emitPipelineSnapshot(): void {
	for (const listener of pipelineListeners) {
		listener();
	}
}

function setPipelineConflict(active: boolean): void {
	pipelineSnapshot.phase = active ? 'conflict' : 'idle';
	pipelineSnapshot.pendingSources = active ? ['persist'] : [];
	pipelineSnapshot.lastConflict = active
		? new Error('Desktop shell state changed in another session')
		: null;
	emitPipelineSnapshot();
}

vi.mock('../../utils/desktopPersistPatchQueue', () => ({
	flushDesktopPersistPatchQueue,
	getDesktopPersistPatchQueueCounts,
	subscribeDesktopPersistPatchQueue: vi.fn(() => () => {}),
}));

function getPipelineSnapshot() {
	return {
		phase: pipelineSnapshot.phase,
		etag: null,
		pendingSources: [...pipelineSnapshot.pendingSources],
		lastConflict: pipelineSnapshot.lastConflict,
	};
}

vi.mock('../../utils/desktopShellStateMutationPipeline', () => ({
	scheduleShellStateMutation,
	flushShellStatePipelineNow,
	resolveShellStateConflict,
	setShellStatePipelineFlushFailureHook: vi.fn(),
	getShellStatePipelineSnapshot: getPipelineSnapshot,
	subscribeShellStatePipeline: (
		listener: (snapshot: ReturnType<typeof getPipelineSnapshot>) => void
	) => {
		const wrapped = () => {
			listener(getPipelineSnapshot());
		};
		pipelineListeners.add(wrapped);
		wrapped();
		return () => {
			pipelineListeners.delete(wrapped);
		};
	},
}));

import { useDesktopWorkspacePersistQueue } from '../useDesktopWorkspacePersistQueue';

describe('useDesktopWorkspacePersistQueue', () => {
	beforeEach(() => {
		flushDesktopPersistPatchQueue.mockReset();
		getDesktopPersistPatchQueueCounts.mockClear();
		scheduleShellStateMutation.mockReset();
		flushShellStatePipelineNow.mockReset();
		resolveShellStateConflict.mockReset();
		flushShellStatePipelineNow.mockResolvedValue(undefined);
		resolveShellStateConflict.mockResolvedValue(undefined);
		pipelineListeners.clear();
		pipelineSnapshot.phase = 'idle';
		pipelineSnapshot.pendingSources = [];
		pipelineSnapshot.lastConflict = null;
	});

	it('flushes queued config and shell patches for the auth subject', async () => {
		const applyPersistedConfigPatch = vi.fn(async () => undefined);
		const refreshExpansionSettings = vi.fn(async () => undefined);
		flushDesktopPersistPatchQueue.mockImplementation(async (params) => {
			await params.patchConfig({ theme: 'dark' });
			await params.patchShell({ quiet_mode: true });
			return { ok: true };
		});

		const { result } = renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: 'user-1',
				isOnline: true,
				applyPersistedConfigPatch,
				refreshExpansionSettings,
			})
		);

		await act(async () => {
			await result.current.flushPersistPatches();
		});

		expect(flushDesktopPersistPatchQueue).toHaveBeenCalledWith(
			expect.objectContaining({ subject: 'user-1' })
		);
		expect(applyPersistedConfigPatch).toHaveBeenCalledWith({ theme: 'dark' });
		expect(scheduleShellStateMutation).toHaveBeenCalledWith({
			source: 'persist',
			merge: expect.any(Function),
			immediate: true,
		});
		const mergeFn = scheduleShellStateMutation.mock.calls[0]?.[0]?.merge;
		expect(mergeFn?.({})).toEqual({ quiet_mode: true });
		expect(flushShellStatePipelineNow).toHaveBeenCalledWith('persist');
		expect(refreshExpansionSettings).toHaveBeenCalled();
	});

	it('surfaces stale-write queue drain conflicts from pipeline snapshot', async () => {
		flushDesktopPersistPatchQueue
			.mockResolvedValueOnce({
				ok: false,
				error: 'Desktop shell state changed in another session',
			})
			.mockResolvedValueOnce({ ok: true });

		const { result, rerender } = renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: 'user-1',
				isOnline: true,
				applyPersistedConfigPatch: vi.fn(),
				refreshExpansionSettings: vi.fn(),
			})
		);

		await waitFor(() => {
			expect(flushDesktopPersistPatchQueue).toHaveBeenCalledTimes(1);
		});

		act(() => {
			setPipelineConflict(true);
		});

		expect(result.current.persistPatchFlushFailed).toBeNull();
		expect(result.current.persistPatchConflict).toBe(true);
		expect(result.current.persistQueueFlushing).toBe(false);

		rerender();
		expect(flushDesktopPersistPatchQueue).toHaveBeenCalledTimes(1);

		act(() => {
			result.current.clearPersistPatchConflict();
		});

		expect(resolveShellStateConflict).toHaveBeenCalled();

		await waitFor(() => {
			expect(flushDesktopPersistPatchQueue).toHaveBeenCalledTimes(2);
		});

		act(() => {
			setPipelineConflict(false);
		});

		expect(result.current.persistPatchConflict).toBe(false);
		expect(result.current.persistPatchFlushFailed).toBeNull();
	});

	it('keeps persistPatchConflict true for the whole failed flush attempt', async () => {
		let resolveFlush: (value: { ok: boolean; error?: string }) => void =
			() => {};
		flushDesktopPersistPatchQueue.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFlush = resolve;
				})
		);

		const { result } = renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: 'user-1',
				isOnline: true,
				applyPersistedConfigPatch: vi.fn(),
				refreshExpansionSettings: vi.fn(),
			})
		);

		await waitFor(() => {
			expect(result.current.persistQueueFlushing).toBe(true);
		});
		expect(result.current.persistPatchConflict).toBe(false);

		await act(async () => {
			resolveFlush({
				ok: false,
				error: 'Desktop shell state changed in another session',
			});
			setPipelineConflict(true);
		});

		expect(result.current.persistPatchConflict).toBe(true);
		expect(result.current.persistQueueFlushing).toBe(false);
	});

	it('does not auto-flush again while pipeline persist conflict is active', async () => {
		setPipelineConflict(true);

		renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: 'user-1',
				isOnline: true,
				applyPersistedConfigPatch: vi.fn(),
				refreshExpansionSettings: vi.fn(),
			})
		);

		await act(async () => {
			await Promise.resolve();
		});

		expect(flushDesktopPersistPatchQueue).not.toHaveBeenCalled();
	});
});
