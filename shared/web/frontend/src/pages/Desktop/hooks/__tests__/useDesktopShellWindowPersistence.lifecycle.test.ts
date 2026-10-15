/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lifecycle coverage for shell_state window restore followed by normalized windows_snapshot persistence.
 *
 * Invariants:
 * - Desktop API and coalesced writer are mocked; no network calls are made.
 * - L1: no outbound windows_snapshot schedule before Terminal Restore Ready.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopShellWindowPersistence.ts
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	DesktopItem,
	PersistedWindowState,
	WindowState,
} from '../../types/desktop.types';
import { useDesktopShellWindowPersistence } from '../useDesktopShellWindowPersistence';

const fetchDesktopShellStateDeduplicated = vi.hoisted(() => vi.fn());
const peekDesktopShellStateCache = vi.hoisted(() => vi.fn());
const scheduleShellStateMutation = vi.hoisted(() => vi.fn());
const flushShellStatePipelineNow = vi.hoisted(() =>
	vi.fn().mockResolvedValue(undefined)
);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			params ? `${key}:${JSON.stringify(params)}` : key,
	}),
}));

vi.mock('../../services/desktopApi', () => ({
	fetchDesktopShellStateDeduplicated,
	peekDesktopShellStateCache,
	isDesktopShellStateConflictError: (error: unknown) =>
		error != null &&
		typeof error === 'object' &&
		(error as { name?: string }).name === 'DesktopShellStateConflictError',
}));

vi.mock('../../utils/desktopShellStateMutationPipeline', () => ({
	scheduleShellStateMutation,
	flushShellStatePipelineNow,
}));

vi.mock('../../utils/desktopPersistPatchQueue', () => ({
	enqueueDesktopPersistShellPatch: vi.fn(),
}));

function persistedWindow(
	patch?: Partial<PersistedWindowState>
): PersistedWindowState {
	return {
		title: 'Folder',
		type: 'folder',
		folderId: 'folder-1',
		path: ['Folder'],
		position: { x: 10, y: 20 },
		size: { width: 500, height: 360 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 7,
		...patch,
	};
}

function desktopItem(id: string): DesktopItem {
	return {
		id,
		name: id,
		type: 'folder',
		position: { x: 0, y: 0 },
	};
}

function windowState(id: string, patch?: Partial<WindowState>): WindowState {
	return {
		id,
		title: 'Folder',
		type: 'folder',
		folderId: 'folder-1',
		path: ['Folder'],
		position: { x: 1, y: 2 },
		size: { width: 400, height: 320 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 3,
		...patch,
	};
}

describe('useDesktopShellWindowPersistence lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		fetchDesktopShellStateDeduplicated.mockResolvedValue({
			windows_snapshot: {
				activeDesktopId: 'desk-restore',
				windows: [persistedWindow()],
			},
		});
		peekDesktopShellStateCache.mockReturnValue({ ewa_hints: {} });
		scheduleShellStateMutation.mockClear();
		flushShellStatePipelineNow.mockClear();
		flushShellStatePipelineNow.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('restores server shell_state snapshot and persists the current normalized snapshot', async () => {
		const restoreWindows = vi.fn();
		const switchToDesktop = vi.fn();
		const desktopToast = { info: vi.fn() };

		renderHook(() =>
			useDesktopShellWindowPersistence({
				windows: [windowState('win-1')],
				desktops: [{ id: 'desk-current', windows: ['win-1'] }],
				activeDesktopId: 'desk-current',
				installedApps: [],
				installedAppsLoading: false,
				storeApps: [],
				items: [desktopItem('folder-1')],
				restoreWindows,
				switchToDesktop,
				desktopToast,
				persistSubjectKey: 'user-1',
			})
		);

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(restoreWindows).toHaveBeenCalledWith(
			[persistedWindow()],
			[desktopItem('folder-1')]
		);
		expect(switchToDesktop).toHaveBeenCalledWith('desk-restore');

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(scheduleShellStateMutation).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'windows',
				debounceMs: 1500,
				merge: expect.any(Function),
			})
		);
		const mergeFn = scheduleShellStateMutation.mock.calls.at(-1)?.[0]?.merge;
		expect(mergeFn?.({ ewa_hints: {} })).toEqual(
			expect.objectContaining({
				windows_snapshot: {
					activeDesktopId: 'desk-current',
					windows: [
						expect.objectContaining({
							title: 'Folder',
							folderId: 'folder-1',
							desktopId: 'desk-current',
							zIndex: 3,
						}),
					],
				},
			})
		);
	});

	it('preserves desktop id and z-index across multi-desktop restore and persist', async () => {
		fetchDesktopShellStateDeduplicated.mockResolvedValueOnce({
			windows_snapshot: {
				activeDesktopId: 'desk-b',
				windows: [
					persistedWindow({
						folderId: 'folder-a',
						desktopId: 'desk-a',
						zIndex: 11,
					}),
					persistedWindow({
						folderId: 'folder-b',
						desktopId: 'desk-b',
						zIndex: 99,
					}),
				],
			},
		});
		const restoreWindows = vi.fn();
		const switchToDesktop = vi.fn();
		const desktopToast = { info: vi.fn() };

		renderHook(() =>
			useDesktopShellWindowPersistence({
				windows: [
					windowState('win-a', { folderId: 'folder-a', zIndex: 11 }),
					windowState('win-b', { folderId: 'folder-b', zIndex: 99 }),
				],
				desktops: [
					{ id: 'desk-a', windows: ['win-a'] },
					{ id: 'desk-b', windows: ['win-b'] },
				],
				activeDesktopId: 'desk-b',
				installedApps: [],
				installedAppsLoading: false,
				storeApps: [],
				items: [desktopItem('folder-a'), desktopItem('folder-b')],
				restoreWindows,
				switchToDesktop,
				desktopToast,
				persistSubjectKey: 'user-1',
			})
		);

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(switchToDesktop).toHaveBeenCalledWith('desk-b');
		expect(restoreWindows).toHaveBeenCalledWith(
			[
				expect.objectContaining({ desktopId: 'desk-a', zIndex: 11 }),
				expect.objectContaining({ desktopId: 'desk-b', zIndex: 99 }),
			],
			[desktopItem('folder-a'), desktopItem('folder-b')]
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(scheduleShellStateMutation).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'windows',
				debounceMs: 1500,
				merge: expect.any(Function),
			})
		);
		const mergeFn = scheduleShellStateMutation.mock.calls.at(-1)?.[0]?.merge;
		expect(mergeFn?.({ ewa_hints: {} })).toEqual(
			expect.objectContaining({
				windows_snapshot: {
					activeDesktopId: 'desk-b',
					windows: [
						expect.objectContaining({
							folderId: 'folder-a',
							desktopId: 'desk-a',
							zIndex: 11,
						}),
						expect.objectContaining({
							folderId: 'folder-b',
							desktopId: 'desk-b',
							zIndex: 99,
						}),
					],
				},
			})
		);
	});

	it('does not reschedule unchanged window snapshots when parent arrays change identity', async () => {
		const restoreWindows = vi.fn();
		const switchToDesktop = vi.fn();
		const desktopToast = { info: vi.fn() };
		const firstWindow = windowState('win-1', { zIndex: 7 });
		const firstDesktop = { id: 'desk-current', windows: ['win-1'] };

		const { rerender } = renderHook(
			(props: {
				windows: WindowState[];
				desktops: Array<typeof firstDesktop>;
			}) =>
				useDesktopShellWindowPersistence({
					windows: props.windows,
					desktops: props.desktops,
					activeDesktopId: 'desk-current',
					installedApps: [],
					installedAppsLoading: false,
					storeApps: [],
					items: [desktopItem('folder-1')],
					restoreWindows,
					switchToDesktop,
					desktopToast,
					persistSubjectKey: 'user-1',
				}),
			{
				initialProps: {
					windows: [firstWindow],
					desktops: [firstDesktop],
				},
			}
		);

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(1500);
		});

		const callsBeforeSameSnapshotRerender =
			scheduleShellStateMutation.mock.calls.length;

		rerender({
			windows: [windowState('win-1', { zIndex: 7 })],
			desktops: [{ id: 'desk-current', windows: ['win-1'] }],
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(scheduleShellStateMutation).toHaveBeenCalledTimes(
			callsBeforeSameSnapshotRerender
		);
	});

	it('L1: does not schedule windows_snapshot before Terminal Restore Ready', async () => {
		let resolveFetch: (value: unknown) => void = () => undefined;
		fetchDesktopShellStateDeduplicated.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				})
		);
		const restoreWindows = vi.fn();
		const switchToDesktop = vi.fn();
		const desktopToast = { info: vi.fn() };

		renderHook(() =>
			useDesktopShellWindowPersistence({
				windows: [],
				desktops: [{ id: 'desk-current', windows: [] }],
				activeDesktopId: 'desk-current',
				installedApps: [],
				installedAppsLoading: false,
				storeApps: [],
				items: [desktopItem('folder-1')],
				restoreWindows,
				switchToDesktop,
				desktopToast,
				persistSubjectKey: 'user-1',
			})
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
			await Promise.resolve();
		});

		expect(scheduleShellStateMutation).not.toHaveBeenCalled();
		expect(restoreWindows).not.toHaveBeenCalled();

		await act(async () => {
			resolveFetch({
				windows_snapshot: {
					activeDesktopId: 'desk-restore',
					windows: [persistedWindow()],
				},
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(restoreWindows).toHaveBeenCalled();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1500);
		});

		expect(scheduleShellStateMutation).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'windows',
				debounceMs: 1500,
			})
		);
	});

	it('reconciles VD membership to live window ids only after Terminal Restore Ready', async () => {
		const restoreWindows = vi.fn();
		const switchToDesktop = vi.fn();
		const reconcileWindowMembership = vi.fn();
		const desktopToast = { info: vi.fn() };

		renderHook(() =>
			useDesktopShellWindowPersistence({
				windows: [windowState('win-live')],
				desktops: [
					{
						id: 'desk-current',
						windows: ['win-live', 'w-orphan-1', 'w-orphan-2'],
					},
				],
				activeDesktopId: 'desk-current',
				installedApps: [],
				installedAppsLoading: false,
				storeApps: [],
				items: [desktopItem('folder-1')],
				restoreWindows,
				switchToDesktop,
				desktopToast,
				persistSubjectKey: 'user-1',
				reconcileWindowMembership,
			})
		);

		expect(reconcileWindowMembership).not.toHaveBeenCalled();

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(restoreWindows).toHaveBeenCalled();
		expect(reconcileWindowMembership).toHaveBeenCalledWith(['win-live']);
	});

	it('L1: empty windows before restore never register pagehide flush', async () => {
		let resolveFetch: (value: unknown) => void = () => undefined;
		fetchDesktopShellStateDeduplicated.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve;
				})
		);
		const addSpy = vi.spyOn(window, 'addEventListener');

		renderHook(() =>
			useDesktopShellWindowPersistence({
				windows: [],
				desktops: [{ id: 'desk-current', windows: [] }],
				activeDesktopId: 'desk-current',
				installedApps: [],
				installedAppsLoading: false,
				storeApps: [],
				items: [desktopItem('folder-1')],
				restoreWindows: vi.fn(),
				switchToDesktop: vi.fn(),
				desktopToast: { info: vi.fn() },
				persistSubjectKey: 'user-1',
			})
		);

		await act(async () => {
			await Promise.resolve();
		});

		const pagehideBeforeRestore = addSpy.mock.calls.filter(
			([type]) => type === 'pagehide'
		);
		expect(pagehideBeforeRestore).toHaveLength(0);

		await act(async () => {
			resolveFetch({
				windows_snapshot: {
					activeDesktopId: 'desk-current',
					windows: [],
				},
			});
			await Promise.resolve();
			await Promise.resolve();
		});

		const pagehideAfterRestore = addSpy.mock.calls.filter(
			([type]) => type === 'pagehide'
		);
		expect(pagehideAfterRestore.length).toBeGreaterThan(0);
		addSpy.mockRestore();
	});
});
