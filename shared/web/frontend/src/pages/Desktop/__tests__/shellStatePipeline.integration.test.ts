/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Integration tests for the desktop shell-state mutation pipeline: multi-source merge,
 * 412 conflict phase, persist-queue drain, and auto-recover retry UX.
 *
 * Invariants:
 * - Only the desktop API layer is mocked; pipeline, persist queue, and hooks are real.
 *
 * Related:
 * - utils/desktopShellStateMutationPipeline.ts
 * - utils/desktopPersistPatchQueue.ts
 * - hooks/useDesktopWorkspacePersistQueue.ts
 * - hooks/useDesktopStaleShellStateAutoRecover.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/authSession', () => ({
	default: {
		token: 'integration-test-token',
		authenticated: true,
		logout: vi.fn(),
	},
	authSession: {
		token: 'integration-test-token',
		authenticated: true,
		logout: vi.fn(),
	},
	notifySessionReplaced: vi.fn(),
}));

vi.mock('../services/desktopConditionalGet', () => ({
	getDesktopConditionalCacheEtag: vi.fn(() => '"etag-a"'),
	updateDesktopConditionalCache: vi.fn(),
	invalidateDesktopConditionalCache: vi.fn(),
	desktopConditionalJsonGet: vi.fn(),
}));

import {
	asDesktopShellState,
	emptyDesktopShellState,
} from '../__fixtures__/desktopTestHelpers';
import * as desktopApi from '../services/desktopApi';
import { DesktopShellStateConflictError } from '../services/desktopApi';
import {
	getDesktopPersistPatchQueueCounts,
	enqueueDesktopPersistShellPatch,
} from '../utils/desktopPersistPatchQueue';
import {
	flushShellStatePipelineNow,
	getShellStatePipelineSnapshot,
	getShellStatePipelineTelemetry,
	resetShellStatePipeline,
	resolveShellStateConflict,
	scheduleShellStateMutation,
} from '../utils/desktopShellStateMutationPipeline';
import { useDesktopWorkspacePersistQueue } from '../hooks/useDesktopWorkspacePersistQueue';
import {
	getStaleShellAutoRecoverSnapshot,
	notifyStaleShellManualRecoverStarted,
	resetStaleShellAutoRecoverUiForTests,
} from '../hooks/useDesktopStaleShellStateAutoRecover';

const SUBJECT = 'integration-user';

function ensureLocalStorageForTest(): void {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem('__desktop_shell_probe__', '1');
			localStorage.removeItem('__desktop_shell_probe__');
			return;
		} catch {
			// fall through to install in-memory storage
		}
	}
	const store = new Map<string, string>();
	const storage = {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, String(value));
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		}),
		clear: vi.fn(() => {
			store.clear();
		}),
		key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
		get length() {
			return store.size;
		},
	} satisfies Storage;
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: storage,
	});
}

function mockConflictFlush(): void {
	const conflict = new DesktopShellStateConflictError();
	vi.mocked(desktopApi.patchDesktopShellStateMerged)
		.mockReset()
		.mockRejectedValue(conflict);
}

async function flushTimers(ms = 400): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

describe('shellStatePipeline integration', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		ensureLocalStorageForTest();
		localStorage.clear();
		desktopApi.clearDesktopShellStateCache();
		resetStaleShellAutoRecoverUiForTests();
		resetShellStatePipeline();
		vi.spyOn(desktopApi, 'patchDesktopShellStateMerged').mockImplementation(
			async (patch) => asDesktopShellState(patch)
		);
		vi.spyOn(desktopApi, 'peekDesktopShellStateCache').mockReturnValue(
			emptyDesktopShellState()
		);
		vi.spyOn(
			desktopApi,
			'fetchDesktopShellStateDeduplicated'
		).mockResolvedValue(emptyDesktopShellState());
		vi.spyOn(desktopApi, 'reloadDesktopShellStateForce').mockResolvedValue(
			emptyDesktopShellState()
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		desktopApi.clearDesktopShellStateCache();
		resetStaleShellAutoRecoverUiForTests();
	});

	it('merges multiple writer sources into one PATCH', async () => {
		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => ({ quiet_mode: true }),
		});
		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-a'] }),
		});
		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ timezone: 'UTC' }),
		});

		await flushTimers(400);

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith({
			quiet_mode: true,
			recent_app_ids: ['app-a'],
			timezone: 'UTC',
		});
		expect(getShellStatePipelineTelemetry().pendingSources).toEqual([]);
	});

	it('enters conflict phase on terminal 412 and blocks further PATCH until resolve', async () => {
		mockConflictFlush();

		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => ({ quiet_mode: true }),
			immediate: true,
		});

		await flushTimers(0);
		expect(getShellStatePipelineSnapshot().phase).toBe('conflict');
		const patchCallsAfterConflict = vi.mocked(
			desktopApi.patchDesktopShellStateMerged
		).mock.calls.length;

		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => ({ quiet_mode: false }),
			immediate: true,
		});
		await flushTimers(400);
		expect(
			vi.mocked(desktopApi.patchDesktopShellStateMerged).mock.calls.length
		).toBe(patchCallsAfterConflict);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockResolvedValueOnce({
			quiet_mode: false,
		});
		await act(async () => {
			await resolveShellStateConflict();
		});

		expect(getShellStatePipelineSnapshot().phase).toBe('idle');
		expect(
			vi.mocked(desktopApi.patchDesktopShellStateMerged).mock.calls.length
		).toBeGreaterThan(patchCallsAfterConflict);
	});

	it('supports user retry on persist-queue conflict after clearPersistPatchConflict', async () => {
		enqueueDesktopPersistShellPatch(SUBJECT, {
			virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
		});
		expect(getDesktopPersistPatchQueueCounts(SUBJECT).shell).toBe(1);

		mockConflictFlush();

		const { result } = renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: SUBJECT,
				isOnline: true,
				applyPersistedConfigPatch: vi.fn(async () => undefined),
				refreshExpansionSettings: vi.fn(async () => undefined),
			})
		);

		await act(async () => {
			await result.current.flushPersistPatches();
		});

		expect(getShellStatePipelineSnapshot().phase).toBe('conflict');
		expect(getShellStatePipelineSnapshot().pendingSources).toContain('persist');
		expect(result.current.persistPatchConflict).toBe(true);
		expect(getDesktopPersistPatchQueueCounts(SUBJECT).shell).toBe(1);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockImplementation(
			async (patch) => asDesktopShellState({ ...patch })
		);

		await act(async () => {
			result.current.clearPersistPatchConflict();
			await vi.runAllTimersAsync();
		});

		expect(result.current.persistPatchConflict).toBe(false);
		expect(getDesktopPersistPatchQueueCounts(SUBJECT).total).toBe(0);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith(
			expect.objectContaining({
				virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
			})
		);
	});

	it('drains offline queue through pipeline after network recovery', async () => {
		resetShellStatePipeline();
		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockRejectedValueOnce(
			new Error('network down')
		);

		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-offline'] }),
		});
		let caught: unknown;
		try {
			await flushShellStatePipelineNow('mru');
		} catch (error) {
			caught = error;
			enqueueDesktopPersistShellPatch(SUBJECT, {
				recent_app_ids: ['app-offline'],
			});
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).message).toBe('network down');
		expect(getDesktopPersistPatchQueueCounts(SUBJECT).shell).toBe(1);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockImplementation(
			async (patch) => asDesktopShellState({ ...patch })
		);

		const refreshExpansionSettings = vi.fn(async () => undefined);
		const { result } = renderHook(() =>
			useDesktopWorkspacePersistQueue({
				persistSubjectKey: SUBJECT,
				isOnline: true,
				applyPersistedConfigPatch: vi.fn(async () => undefined),
				refreshExpansionSettings,
			})
		);

		await act(async () => {
			await vi.runAllTimersAsync();
		});

		expect(getDesktopPersistPatchQueueCounts(SUBJECT).total).toBe(0);
		expect(refreshExpansionSettings).toHaveBeenCalled();
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith({
			recent_app_ids: ['app-offline'],
		});
		expect(result.current.persistPatchConflict).toBe(false);
	});

	it('manual retry sets attempting phase while pipeline conflict is active', async () => {
		mockConflictFlush();
		scheduleShellStateMutation({
			source: 'persist',
			merge: () => ({ quiet_mode: true }),
			immediate: true,
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(getShellStatePipelineSnapshot().phase).toBe('conflict');

		notifyStaleShellManualRecoverStarted();
		expect(getStaleShellAutoRecoverSnapshot().phase).toBe('attempting');
	});

	it('resets pipeline between tests without leaking conflict phase', () => {
		resetShellStatePipeline();
		expect(getShellStatePipelineSnapshot().phase).toBe('idle');
		expect(getShellStatePipelineTelemetry().conflictFlushCount).toBe(0);
	});
});
