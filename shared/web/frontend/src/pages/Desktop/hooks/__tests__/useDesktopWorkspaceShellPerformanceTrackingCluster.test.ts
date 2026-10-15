/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for T36 shell performance tracking cluster: timed wrappers, overlay burst
 * effects, and window persistence wiring.
 *
 * Invariants:
 * - Tracked restore/drag-commit record shell actions with elapsed duration; persistence receives tracked restore.
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellPerformanceTrackingCluster.ts
 * - hooks/useDesktopWorkspaceShellPerformanceTrackingClusterInput.ts
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const windowPersistenceHook = vi.hoisted(() => vi.fn());

vi.mock('../useDesktopShellWindowPersistence', () => ({
	useDesktopShellWindowPersistence: windowPersistenceHook,
}));

import { useDesktopWorkspaceShellPerformanceTrackingCluster } from '../useDesktopWorkspaceShellPerformanceTrackingCluster';
import { useDesktopWorkspaceShellPerformanceTrackingClusterInput } from '../useDesktopWorkspaceShellPerformanceTrackingClusterInput';

function mockMonotonicPerformanceNow(start = 100, step = 50) {
	let current = start;
	return vi.spyOn(window.performance, 'now').mockImplementation(() => {
		const value = current;
		current += step;
		return value;
	});
}

const minimalClusterInput = () => {
	const restoreWindows = vi.fn();
	const handleWindowDragCommit = vi.fn();
	const recordShellAction = vi.fn();

	return {
		recordShellAction,
		windowOps: { restoreWindows, handleWindowDragCommit },
		overlayBurst: {
			showQuickSearch: false,
			showTaskSwitcher: false,
			showAppStore: false,
			currentDesktopWindowCount: 2,
		},
		windowPersistence: {
			windows: [],
			desktops: [{ id: 'd1', windows: [] }],
			activeDesktopId: 'd1',
			installedApps: [],
			installedAppsLoading: false,
			storeApps: [],
			items: [],
			switchToDesktop: vi.fn(),
			desktopToast: { info: vi.fn() },
			persistSubjectKey: 'user-1',
		},
		restoreWindows,
		handleWindowDragCommit,
	};
};

describe('useDesktopWorkspaceShellPerformanceTrackingCluster', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 1;
		});
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(
			() => undefined
		);
	});

	it('wires tracked restore into window persistence', () => {
		mockMonotonicPerformanceNow();
		const input = minimalClusterInput();
		renderHook(() => useDesktopWorkspaceShellPerformanceTrackingCluster(input));

		expect(windowPersistenceHook).toHaveBeenCalledWith(
			expect.objectContaining({
				persistSubjectKey: 'user-1',
				restoreWindows: expect.any(Function),
			})
		);

		input.recordShellAction.mockClear();
		const trackedRestore =
			windowPersistenceHook.mock.calls[0]?.[0]?.restoreWindows;
		trackedRestore([], []);
		expect(input.restoreWindows).toHaveBeenCalledWith([], []);
		expect(input.recordShellAction).toHaveBeenCalledWith(
			'restore-burst',
			expect.any(Number)
		);
	});

	it('tracks window drag commit duration', () => {
		mockMonotonicPerformanceNow();
		const input = minimalClusterInput();
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellPerformanceTrackingCluster(input)
		);

		input.recordShellAction.mockClear();
		result.current.trackedHandleWindowDragCommit('w1', 10, 20);
		expect(input.handleWindowDragCommit).toHaveBeenCalledWith('w1', 10, 20);
		expect(input.recordShellAction).toHaveBeenCalledWith(
			'window-drag-commit',
			expect.any(Number)
		);
	});

	it('records primary overlay open and close transitions', () => {
		mockMonotonicPerformanceNow();
		const input = minimalClusterInput();
		const { rerender } = renderHook(
			(props) => useDesktopWorkspaceShellPerformanceTrackingCluster(props),
			{ initialProps: input }
		);

		input.recordShellAction.mockClear();
		rerender({
			...input,
			overlayBurst: { ...input.overlayBurst, showQuickSearch: true },
		});
		expect(input.recordShellAction).toHaveBeenCalledWith(
			'primary-overlay-open'
		);

		input.recordShellAction.mockClear();
		rerender({
			...input,
			overlayBurst: { ...input.overlayBurst, showQuickSearch: false },
		});
		expect(input.recordShellAction).toHaveBeenCalledWith(
			'primary-overlay-close'
		);
	});

	it('records shell chrome render burst after animation frame', () => {
		mockMonotonicPerformanceNow();
		const input = minimalClusterInput();
		renderHook(() => useDesktopWorkspaceShellPerformanceTrackingCluster(input));

		expect(input.recordShellAction).toHaveBeenCalledWith(
			'shell-chrome-render-burst',
			expect.any(Number)
		);
	});

	it('re-samples shell chrome burst when overlay burst key changes', () => {
		mockMonotonicPerformanceNow();
		const input = minimalClusterInput();
		const { rerender } = renderHook(
			(props) => useDesktopWorkspaceShellPerformanceTrackingCluster(props),
			{ initialProps: input }
		);

		input.recordShellAction.mockClear();
		rerender({
			...input,
			overlayBurst: { ...input.overlayBurst, showAppStore: true },
		});

		expect(input.recordShellAction).toHaveBeenCalledWith(
			'primary-overlay-open'
		);
		expect(input.recordShellAction).toHaveBeenCalledWith(
			'shell-chrome-render-burst',
			expect.any(Number)
		);
	});
});

describe('useDesktopWorkspaceShellPerformanceTrackingClusterInput', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockMonotonicPerformanceNow();
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 1;
		});
	});

	it('forwards grouped sources to cluster hook', () => {
		const input = minimalClusterInput();
		const { result } = renderHook(() =>
			useDesktopWorkspaceShellPerformanceTrackingClusterInput({
				recordShellAction: input.recordShellAction,
				windowOps: input.windowOps,
				overlayBurst: input.overlayBurst,
				windowPersistence: input.windowPersistence,
			})
		);

		expect(windowPersistenceHook).toHaveBeenCalled();
		expect(result.current.trackedHandleWindowDragCommit).toEqual(
			expect.any(Function)
		);
	});
});
