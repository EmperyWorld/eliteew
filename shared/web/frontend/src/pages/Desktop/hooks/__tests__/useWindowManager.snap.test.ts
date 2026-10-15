/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Snap sub-hook tests for useWindowManager grid presets.
 *
 * Invariants:
 * - snapWindow applies zone layout and clears snapZone.
 *
 * Related:
 * - `hooks/useWindowManagerSnap.ts`, `hooks/useWindowManager.ts`
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { useWindowManagerSnap } from '../useWindowManagerSnap';

vi.mock('../../utils/desktopSnapGeometry', () => ({
	getSnapZoneForClientPosition: vi.fn((clientX: number) =>
		clientX < 10 ? 'left' : null
	),
}));

vi.mock('../../utils/desktopWindowGeometry', () => ({
	getMaximizedWindowBounds: vi.fn(() => ({
		position: { x: 0, y: 0 },
		size: { width: 1200, height: 800 },
	})),
	buildSnapWindowStatePatch: vi.fn((window: WindowState) => ({
		position: { x: 0, y: 0 },
		size: { width: 600, height: 800 },
		isMaximized: false,
		isMinimized: false,
		isMinimizing: false,
		restoreBounds: {
			position: window.position,
			size: window.size,
		},
	})),
}));

function seedWindow(id: string): WindowState {
	return {
		id,
		title: 'Test',
		type: 'app',
		position: { x: 100, y: 80 },
		size: { width: 640, height: 480 },
		zIndex: 1,
		isMinimized: false,
		isMaximized: false,
		path: [],
		restoreBounds: null,
	};
}

describe('useWindowManagerSnap', () => {
	it('updates snap zone from pointer position', () => {
		const setWindows = vi.fn();
		const { result } = renderHook(() => useWindowManagerSnap(setWindows));

		act(() => {
			result.current.updateSnapZone(5, 100);
		});
		expect(result.current.snapZone).toBe('left');

		act(() => {
			result.current.updateSnapZone(500, 100);
		});
		expect(result.current.snapZone).toBeNull();
	});

	it('snaps target window and clears snap zone', () => {
		let windows = [seedWindow('w1')];
		const setWindows = vi.fn((updater) => {
			windows =
				typeof updater === 'function'
					? (updater as (prev: WindowState[]) => WindowState[])(windows)
					: updater;
		});
		const { result } = renderHook(() => useWindowManagerSnap(setWindows));

		act(() => {
			result.current.updateSnapZone(5, 5);
		});
		expect(result.current.snapZone).toBe('left');

		act(() => {
			result.current.snapWindow('w1', 'left');
		});

		expect(result.current.snapZone).toBeNull();
		expect(windows[0]?.position).toEqual({ x: 0, y: 0 });
		expect(windows[0]?.size).toEqual({ width: 600, height: 800 });
		expect(windows[0]?.restoreBounds).toEqual({
			position: { x: 100, y: 80 },
			size: { width: 640, height: 480 },
		});
	});

	it('ignores snapWindow when zone is null', () => {
		const setWindows = vi.fn();
		const { result } = renderHook(() => useWindowManagerSnap(setWindows));

		act(() => {
			result.current.snapWindow('w1', null);
		});

		expect(setWindows).not.toHaveBeenCalled();
	});
});
