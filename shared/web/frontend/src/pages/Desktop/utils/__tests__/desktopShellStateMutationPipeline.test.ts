/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for shell-state mutation pipeline FSM, coalescing, bounded 412 recovery, and conflict phase.
 *
 * Invariants:
 * - Tests mock the desktop API layer; no network calls are made.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopShellStateMutationPipeline.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asDesktopShellState } from '../../__fixtures__/desktopTestHelpers';
import * as desktopApi from '../../services/desktopApi';
import { invalidateDesktopConditionalCache } from '../../services/desktopConditionalGet';
import { setBrowserTabLeaderRole } from '@/utils/browserTabLeaderState';
import { APIError } from '../../../../services/api/client';
import {
	flushShellStatePipelineNow,
	flushShellStatePipelineOnPageHide,
	getShellStatePipelineSnapshot,
	resetShellStatePipeline,
	resolveShellStateConflict,
	scheduleShellStateMutation,
	setShellStatePipelineFlushFailureHook,
	subscribeShellStatePipeline,
} from '../desktopShellStateMutationPipeline';

describe('desktopShellStateMutationPipeline', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setBrowserTabLeaderRole('leader');
		resetShellStatePipeline();
		invalidateDesktopConditionalCache('shell-state');
		vi.spyOn(desktopApi, 'peekDesktopShellStateCache').mockReturnValue({});
		vi.spyOn(
			desktopApi,
			'fetchDesktopShellStateDeduplicated'
		).mockResolvedValue({});
		vi.spyOn(desktopApi, 'reloadDesktopShellStateForce').mockResolvedValue({});
		vi.spyOn(desktopApi, 'patchDesktopShellStateKeepalive').mockImplementation(
			vi.fn()
		);
		vi.spyOn(desktopApi, 'patchDesktopShellStateMerged').mockImplementation(
			async (patch) => asDesktopShellState({ ...patch })
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		resetShellStatePipeline();
	});

	it('coalesces mutations from multiple sources into one PATCH', async () => {
		scheduleShellStateMutation({
			source: 'expansion',
			merge: () => ({ workspace_profiles: { profiles: [] } }),
		});
		scheduleShellStateMutation({
			source: 'virtualDesktops',
			merge: () => ({
				virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
			}),
		});

		await vi.advanceTimersByTimeAsync(400);
		await vi.runAllTimersAsync();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith(
			{
				workspace_profiles: { profiles: [] },
				virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
			},
			expect.objectContaining({ idempotencyKey: expect.any(String) })
		);
	});

	it('keeps windows_snapshot and virtual_desktops when both sources schedule (L2)', async () => {
		scheduleShellStateMutation({
			source: 'windows',
			merge: () => ({
				windows_snapshot: { activeDesktopId: 'd1', windows: [] },
			}),
		});
		scheduleShellStateMutation({
			source: 'virtualDesktops',
			merge: () => ({
				virtual_desktops: {
					activeDesktopId: 'd1',
					desktops: [{ id: 'd1', name: 'Desk', isActive: true, windows: [] }],
				},
			}),
		});

		await vi.advanceTimersByTimeAsync(400);
		await vi.runAllTimersAsync();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith(
			{
				windows_snapshot: { activeDesktopId: 'd1', windows: [] },
				virtual_desktops: {
					activeDesktopId: 'd1',
					desktops: [{ id: 'd1', name: 'Desk', isActive: true, windows: [] }],
				},
			},
			expect.objectContaining({ idempotencyKey: expect.any(String) })
		);
	});

	it('deep-merges nested keys from concurrent sources', async () => {
		scheduleShellStateMutation({
			source: 'virtualDesktops',
			merge: () => ({
				virtual_desktops: { activeDesktopId: 'd1' },
			}),
		});
		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({
				virtual_desktops: { desktops: [] },
			}),
		});

		await vi.advanceTimersByTimeAsync(400);
		await vi.runAllTimersAsync();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith(
			{
				virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
			},
			expect.objectContaining({ idempotencyKey: expect.any(String) })
		);
	});

	it('per-source debounce replaces merge fn for the same source', async () => {
		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => ({ quiet_mode: true }),
		});
		scheduleShellStateMutation({
			source: 'chrome',
			merge: () => ({ quiet_mode: false }),
		});

		await vi.advanceTimersByTimeAsync(400);
		await vi.runAllTimersAsync();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith(
			{
				quiet_mode: false,
			},
			expect.objectContaining({ idempotencyKey: expect.any(String) })
		);
	});

	it('performs at most one reload + one retry PATCH on 412', async () => {
		const conflict = new desktopApi.DesktopShellStateConflictError(
			'stale',
			'"etag-b"'
		);
		vi.mocked(desktopApi.patchDesktopShellStateMerged)
			.mockRejectedValueOnce(conflict)
			.mockResolvedValueOnce({ quiet_mode: true });

		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ quiet_mode: true }),
			immediate: true,
		});

		await flushShellStatePipelineNow();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);
		expect(desktopApi.reloadDesktopShellStateForce).toHaveBeenCalledTimes(1);
		expect(getShellStatePipelineSnapshot().phase).toBe('idle');
	});

	it('enters conflict phase when retry PATCH still returns 412', async () => {
		const conflict = new desktopApi.DesktopShellStateConflictError('stale');
		vi.mocked(desktopApi.patchDesktopShellStateMerged)
			.mockRejectedValueOnce(conflict)
			.mockRejectedValueOnce(conflict);

		scheduleShellStateMutation({
			source: 'persist',
			merge: () => ({ quiet_mode: true }),
		});

		await expect(flushShellStatePipelineNow()).rejects.toBeInstanceOf(
			desktopApi.DesktopShellStateConflictError
		);

		const snapshot = getShellStatePipelineSnapshot();
		expect(snapshot.phase).toBe('conflict');
		expect(snapshot.pendingSources).toContain('persist');
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);
	});

	it('does not start debounce timers while a flush is in-flight', async () => {
		const resolvers: {
			resolve: ((value: desktopApi.DesktopShellState) => void) | null;
		} = { resolve: null };
		const firstPatch = new Promise<desktopApi.DesktopShellState>((resolve) => {
			resolvers.resolve = resolve;
		});
		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockImplementationOnce(
			() => firstPatch
		);

		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ quiet_mode: true }),
			immediate: true,
		});
		void flushShellStatePipelineNow();

		scheduleShellStateMutation({
			source: 'windows',
			merge: () => ({ windows_snapshot: { windows: [] } }),
		});
		await vi.advanceTimersByTimeAsync(5000);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);

		resolvers.resolve?.(asDesktopShellState({ quiet_mode: true }));
		await vi.advanceTimersByTimeAsync(400);
		await vi.runAllTimersAsync();
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);
	});

	it('queues merges during conflict without scheduling debounced PATCH', async () => {
		const conflict = new desktopApi.DesktopShellStateConflictError('stale');
		vi.mocked(desktopApi.patchDesktopShellStateMerged)
			.mockRejectedValueOnce(conflict)
			.mockRejectedValueOnce(conflict);

		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ quiet_mode: true }),
		});
		await expect(flushShellStatePipelineNow()).rejects.toBeInstanceOf(
			desktopApi.DesktopShellStateConflictError
		);

		const callsAfterConflict = vi.mocked(
			desktopApi.patchDesktopShellStateMerged
		).mock.calls.length;

		for (let i = 0; i < 5; i++) {
			scheduleShellStateMutation({
				source: 'windows',
				merge: () => ({
					windows_snapshot: { activeDesktopId: 'd1', windows: [] },
				}),
			});
			await vi.advanceTimersByTimeAsync(400);
		}

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(
			callsAfterConflict
		);
		expect(getShellStatePipelineSnapshot().pendingSources).toContain('windows');
	});

	it('blocks flushes in conflict phase until resolveShellStateConflict', async () => {
		const conflict = new desktopApi.DesktopShellStateConflictError('stale');
		vi.mocked(desktopApi.patchDesktopShellStateMerged)
			.mockRejectedValueOnce(conflict)
			.mockRejectedValueOnce(conflict);

		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ quiet_mode: true }),
		});
		await expect(flushShellStatePipelineNow()).rejects.toBeInstanceOf(
			desktopApi.DesktopShellStateConflictError
		);

		const callsAfterConflict = vi.mocked(
			desktopApi.patchDesktopShellStateMerged
		).mock.calls.length;
		scheduleShellStateMutation({
			source: 'other',
			merge: () => ({ quiet_mode: false }),
		});
		await vi.advanceTimersByTimeAsync(400);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(
			callsAfterConflict
		);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockResolvedValueOnce({
			quiet_mode: false,
		});
		await resolveShellStateConflict();
		expect(
			vi.mocked(desktopApi.patchDesktopShellStateMerged).mock.calls.length
		).toBeGreaterThan(callsAfterConflict);
		expect(getShellStatePipelineSnapshot().phase).toBe('idle');
	});

	it('keeps pending merges on transient network failure', async () => {
		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockRejectedValueOnce(
			new Error('offline')
		);

		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-a'] }),
		});

		await expect(flushShellStatePipelineNow()).rejects.toThrow('offline');
		expect(getShellStatePipelineSnapshot().pendingSources).toEqual(['mru']);
	});

	it('keeps pending merges on API 500 and notifies flushFailureHook', async () => {
		const failureHook = vi.fn();
		setShellStatePipelineFlushFailureHook(failureHook);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockRejectedValueOnce(
			new APIError('Internal Server Error', 500)
		);

		scheduleShellStateMutation({
			source: 'windows',
			merge: () => ({
				windows_snapshot: { windows: [], activeDesktopId: 'd1' },
			}),
		});

		await expect(flushShellStatePipelineNow()).rejects.toSatisfy(
			(error: unknown) => error instanceof APIError && error.statusCode === 500
		);
		expect(getShellStatePipelineSnapshot().pendingSources).toContain('windows');
		expect(failureHook).toHaveBeenCalledWith(
			expect.objectContaining({
				sources: expect.arrayContaining(['windows']),
				error: expect.any(APIError),
			})
		);
		setShellStatePipelineFlushFailureHook(null);
	});

	it('re-arms debounce after transient PATCH failure without a new schedule', async () => {
		vi.mocked(desktopApi.patchDesktopShellStateMerged)
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(
				asDesktopShellState({ recent_app_ids: ['app-a'] })
			);

		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-a'] }),
		});

		await expect(flushShellStatePipelineNow()).rejects.toThrow('offline');
		expect(getShellStatePipelineSnapshot()).toMatchObject({
			phase: 'debouncing',
			pendingSources: ['mru'],
		});
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(400);
		await Promise.resolve();
		await Promise.resolve();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);
		expect(getShellStatePipelineSnapshot().phase).toBe('idle');
		expect(getShellStatePipelineSnapshot().pendingSources).toEqual([]);
	});

	it('notifies pipeline subscribers on phase transitions', () => {
		const phases: string[] = [];
		const unsubscribe = subscribeShellStatePipeline((snapshot) => {
			phases.push(snapshot.phase);
		});

		scheduleShellStateMutation({
			source: 'nowPlaying',
			merge: () => ({
				now_playing: { current_time: 1, volume: 1, track: null },
			}),
		});

		expect(phases).toContain('debouncing');
		unsubscribe();
	});

	it('flushShellStatePipelineOnPageHide sends keepalive pending patch', () => {
		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-a'] }),
		});

		flushShellStatePipelineOnPageHide();

		expect(desktopApi.patchDesktopShellStateKeepalive).toHaveBeenCalledWith({
			recent_app_ids: ['app-a'],
		});
		expect(desktopApi.patchDesktopShellStateMerged).not.toHaveBeenCalled();
	});

	it('flushShellStatePipelineOnPageHide skips keepalive on follower tab', () => {
		setBrowserTabLeaderRole('follower');
		scheduleShellStateMutation({
			source: 'mru',
			merge: () => ({ recent_app_ids: ['app-a'] }),
		});

		flushShellStatePipelineOnPageHide();

		expect(desktopApi.patchDesktopShellStateKeepalive).not.toHaveBeenCalled();
		setBrowserTabLeaderRole('leader');
	});

	it('follower write storm — pagehide never emits keepalive PATCH', async () => {
		setBrowserTabLeaderRole('follower');
		for (let i = 0; i < 12; i++) {
			scheduleShellStateMutation({
				source: 'windows',
				merge: () => ({
					windows_snapshot: { activeDesktopId: `d-${i}`, windows: [] },
				}),
			});
			scheduleShellStateMutation({
				source: 'mru',
				merge: () => ({ recent_app_ids: [`app-${i}`] }),
			});
		}
		await vi.advanceTimersByTimeAsync(400);
		flushShellStatePipelineOnPageHide();
		flushShellStatePipelineOnPageHide();
		expect(desktopApi.patchDesktopShellStateKeepalive).not.toHaveBeenCalled();
		setBrowserTabLeaderRole('leader');
	});

	it('exposes etag from conditional cache in snapshot', () => {
		expect(getShellStatePipelineSnapshot().etag).toBeNull();
	});
});
