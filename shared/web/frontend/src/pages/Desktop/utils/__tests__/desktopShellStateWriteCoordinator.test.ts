/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for coalesced desktop shell-state PATCH writer facade over the mutation pipeline.
 *
 * Invariants:
 * - Tests mock the desktop API layer; no network calls are made.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopShellStateWriteCoordinator.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../services/authSession', () => ({
	default: {
		token: 'test-token',
		authenticated: true,
		logout: vi.fn(),
	},
	authSession: {
		token: 'test-token',
		authenticated: true,
		logout: vi.fn(),
	},
	notifySessionReplaced: vi.fn(),
}));

vi.mock('../../services/desktopConditionalGet', () => ({
	getDesktopConditionalCacheEtag: vi.fn(() => '"etag-a"'),
	updateDesktopConditionalCache: vi.fn(),
	invalidateDesktopConditionalCache: vi.fn(),
	desktopConditionalJsonGet: vi.fn(),
}));

import * as desktopApi from '../../services/desktopApi';
import { asDesktopShellState } from '../../__fixtures__/desktopTestHelpers';
import {
	DesktopShellStateConflictError,
	SHELL_STATE_CONFLICT_MESSAGE,
} from '../../services/desktopApi';
import {
	flushCoalescedDesktopShellStatePatchNow,
	flushCoalescedDesktopShellStatePatchOnPageHide,
	isCoalescedDesktopShellStateWriteConflictPaused,
	peekCoalescedDesktopShellStatePendingKeys,
	resetCoalescedDesktopShellStateWriter,
	resolveShellStateConflict,
	scheduleCoalescedDesktopShellStatePatch,
	scheduleDurableCoalescedDesktopShellStatePatch,
	subscribeCoalescedShellStatePatchErrors,
} from '../desktopShellStateWriteCoordinator';

function mockConflictTwice(message = SHELL_STATE_CONFLICT_MESSAGE): void {
	const conflict = new DesktopShellStateConflictError(message);
	vi.mocked(desktopApi.patchDesktopShellStateMerged)
		.mockReset()
		.mockRejectedValueOnce(conflict)
		.mockRejectedValueOnce(conflict)
		.mockImplementation(async (patch) => asDesktopShellState({ ...patch }));
}

describe('desktopShellStateWriteCoordinator', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetCoalescedDesktopShellStateWriter();
		vi.spyOn(desktopApi, 'patchDesktopShellStateMerged').mockImplementation(
			async (patch) => asDesktopShellState({ ...patch })
		);
		vi.spyOn(desktopApi, 'patchDesktopShellStateKeepalive').mockImplementation(
			() => undefined
		);
		vi.spyOn(desktopApi, 'peekDesktopShellStateCache').mockReturnValue({});
		vi.spyOn(
			desktopApi,
			'fetchDesktopShellStateDeduplicated'
		).mockResolvedValue({});
		vi.spyOn(desktopApi, 'reloadDesktopShellStateForce').mockResolvedValue({});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		resetCoalescedDesktopShellStateWriter();
	});

	it('merges keys from concurrent schedules into one PATCH', async () => {
		const p1 = scheduleCoalescedDesktopShellStatePatch(
			{ workspace_profiles: { profiles: [] } },
			{ source: 'expansion' }
		);
		const p2 = scheduleCoalescedDesktopShellStatePatch(
			{ virtual_desktops: { activeDesktopId: 'd1', desktops: [] } },
			{ source: 'windows' }
		);

		await vi.advanceTimersByTimeAsync(400);
		await Promise.all([p1, p2]);

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith({
			workspace_profiles: { profiles: [] },
			virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
		});
	});

	it('merges MRU and now_playing keys from concurrent schedules', async () => {
		const p1 = scheduleCoalescedDesktopShellStatePatch(
			{ recent_app_ids: ['app-a'] },
			{ source: 'mru' }
		);
		const p2 = scheduleCoalescedDesktopShellStatePatch(
			{
				now_playing: {
					track: {
						id: 't1',
						name: 'Track',
						thumbnail_url: null,
						version: null,
					},
					current_time: 12,
					volume: 0.8,
				},
			},
			{ source: 'nowPlaying' }
		);

		await vi.advanceTimersByTimeAsync(400);
		await Promise.all([p1, p2]);

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith({
			recent_app_ids: ['app-a'],
			now_playing: {
				track: { id: 't1', name: 'Track', thumbnail_url: null, version: null },
				current_time: 12,
				volume: 0.8,
			},
		});
	});

	it('flushes immediately when requested', async () => {
		await scheduleCoalescedDesktopShellStatePatch(
			{ quiet_mode: true },
			{ immediate: true }
		);

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(1);
	});

	it('flushCoalescedDesktopShellStatePatchNow drains pending debounced patch', async () => {
		void scheduleCoalescedDesktopShellStatePatch({ clock_show_seconds: true });
		await flushCoalescedDesktopShellStatePatchNow();

		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledWith({
			clock_show_seconds: true,
		});
	});

	it('notifies error listeners on pipeline conflict and clears on idle', async () => {
		const errors: Array<string | null> = [];
		const unsubscribe = subscribeCoalescedShellStatePatchErrors((message) => {
			errors.push(message);
		});

		mockConflictTwice();
		const failed = scheduleCoalescedDesktopShellStatePatch({
			quiet_mode: true,
		});
		const failedExpectation = expect(failed).rejects.toBeInstanceOf(
			DesktopShellStateConflictError
		);
		await vi.advanceTimersByTimeAsync(400);
		await failedExpectation;
		expect(errors).toContain('Desktop shell state changed in another session');

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockResolvedValueOnce({
			quiet_mode: false,
		});
		await resolveShellStateConflict();
		expect(errors.at(-1)).toBeNull();

		unsubscribe();
	});

	it('persists failed durable patches to the offline queue', async () => {
		const enqueueSpy = vi
			.spyOn(
				await import('../desktopPersistPatchQueue'),
				'enqueueDesktopPersistShellPatch'
			)
			.mockImplementation(() => undefined);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockRejectedValueOnce(
			new Error('offline')
		);

		const failed = scheduleDurableCoalescedDesktopShellStatePatch(
			{ virtual_desktops: { activeDesktopId: 'd1', desktops: [] } },
			{ persistSubjectKey: 'user-1', immediate: true }
		);
		await expect(failed).rejects.toThrow('offline');

		expect(enqueueSpy).toHaveBeenCalledWith('user-1', {
			virtual_desktops: { activeDesktopId: 'd1', desktops: [] },
		});
		enqueueSpy.mockRestore();
	});

	it('reports stale-write conflicts without requeueing or offline persistence', async () => {
		const enqueueSpy = vi
			.spyOn(
				await import('../desktopPersistPatchQueue'),
				'enqueueDesktopPersistShellPatch'
			)
			.mockImplementation(() => undefined);

		mockConflictTwice();

		const failed = scheduleDurableCoalescedDesktopShellStatePatch(
			{ virtual_desktops: { activeDesktopId: 'd1', desktops: [] } },
			{ persistSubjectKey: 'user-1', immediate: true }
		);
		const failedExpectation = expect(failed).rejects.toBeInstanceOf(
			DesktopShellStateConflictError
		);
		await failedExpectation;

		expect(enqueueSpy).not.toHaveBeenCalled();
		expect(isCoalescedDesktopShellStateWriteConflictPaused()).toBe(true);
		enqueueSpy.mockRestore();
	});

	it('pauses debounced PATCH after stale-write conflict until resolve', async () => {
		mockConflictTwice();

		const failed = scheduleCoalescedDesktopShellStatePatch({
			quiet_mode: true,
		});
		const failedExpectation = expect(failed).rejects.toBeInstanceOf(
			DesktopShellStateConflictError
		);
		await vi.advanceTimersByTimeAsync(400);
		await failedExpectation;
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);

		void scheduleCoalescedDesktopShellStatePatch({ quiet_mode: false }).catch(
			() => undefined
		);
		await vi.advanceTimersByTimeAsync(400);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(2);

		vi.mocked(desktopApi.patchDesktopShellStateMerged).mockResolvedValueOnce({
			quiet_mode: false,
		});
		await resolveShellStateConflict();
		expect(isCoalescedDesktopShellStateWriteConflictPaused()).toBe(false);
		expect(desktopApi.patchDesktopShellStateMerged).toHaveBeenCalledTimes(3);
	});

	it('flushCoalescedDesktopShellStatePatchOnPageHide sends keepalive pending patch', () => {
		void scheduleCoalescedDesktopShellStatePatch({
			recent_app_ids: ['app-a'],
		});
		flushCoalescedDesktopShellStatePatchOnPageHide();
		expect(desktopApi.patchDesktopShellStateKeepalive).toHaveBeenCalledWith({
			recent_app_ids: ['app-a'],
		});
		expect(desktopApi.patchDesktopShellStateMerged).not.toHaveBeenCalled();
	});

	it('reports pending patch keys before debounced flush', () => {
		void scheduleCoalescedDesktopShellStatePatch({
			timezone: 'UTC',
			quiet_mode: true,
		});

		expect(peekCoalescedDesktopShellStatePendingKeys().sort()).toEqual([
			'quiet_mode',
			'timezone',
		]);
	});
});
