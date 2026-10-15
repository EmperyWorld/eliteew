/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for immutable window-list geometry commit helpers.
 *
 * Invariants:
 * - Early-return preserves array reference when geometry is unchanged.
 *
 * Related:
 * - `hooks/windowManagerRestoreGeometry.ts`, `hooks/useWindowManager.ts`
 */

import { describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import {
	commitWindowListPosition,
	commitWindowListSize,
	commitWindowsIntoWorkArea,
	syncMaximizedWindowsList,
	toggleWindowListMaximized,
} from '../windowManagerRestoreGeometry';

vi.mock('../../utils/desktopWindowGeometry', () => ({
	getMaximizedWindowBounds: vi.fn(() => ({
		position: { x: 0, y: 0 },
		size: { width: 1200, height: 800 },
	})),
	resolveWindowRestoreBounds: vi.fn(() => ({
		position: { x: 120, y: 80 },
		size: { width: 640, height: 480 },
	})),
	patchMaximizedWindowToWorkAreaBounds: vi.fn(
		(
			window: WindowState,
			bounds: {
				position: { x: number; y: number };
				size: { width: number; height: number };
			}
		) => {
			if (!window.isMaximized) return null;
			if (
				window.position.x === bounds.position.x &&
				window.size.width === bounds.size.width
			) {
				return null;
			}
			return {
				...window,
				position: bounds.position,
				size: bounds.size,
			};
		}
	),
	fitWindowIntoWorkArea: vi.fn(() => ({
		position: { x: 10, y: 10 },
		size: { width: 400, height: 300 },
		isMaximized: false,
		restoreBounds: null,
	})),
}));

vi.mock('../../utils/desktopSnapGeometry', () => ({
	readDesktopWorkArea: vi.fn(() => ({ width: 1200, height: 800 })),
}));

vi.mock('../../utils/desktopWindowMinSizeRegistry', () => ({
	getDesktopWindowMinSize: vi.fn(() => ({ minWidth: 320, minHeight: 240 })),
}));

function seedWindow(overrides: Partial<WindowState> = {}): WindowState {
	return {
		id: 'w1',
		title: 'Test',
		type: 'app',
		position: { x: 100, y: 80 },
		size: { width: 640, height: 480 },
		zIndex: 1,
		isMinimized: false,
		isMaximized: false,
		path: [],
		restoreBounds: null,
		...overrides,
	};
}

describe('commitWindowListPosition', () => {
	it('returns the same array reference when position is unchanged', () => {
		const windows = [seedWindow()];
		const next = commitWindowListPosition(windows, 'w1', 100, 80);
		expect(next).toBe(windows);
	});

	it('patches only the target window position', () => {
		const windows = [
			seedWindow(),
			seedWindow({ id: 'w2', position: { x: 0, y: 0 } }),
		];
		const next = commitWindowListPosition(windows, 'w1', 200, 120);
		expect(next).not.toBe(windows);
		expect(next[0]?.position).toEqual({ x: 200, y: 120 });
		expect(next[1]?.position).toEqual({ x: 0, y: 0 });
	});
});

describe('commitWindowListSize', () => {
	it('returns the same array reference when size is unchanged', () => {
		const windows = [seedWindow()];
		expect(commitWindowListSize(windows, 'w1', 640, 480)).toBe(windows);
	});

	it('updates width and height for the target window', () => {
		const next = commitWindowListSize([seedWindow()], 'w1', 800, 600);
		expect(next[0]?.size).toEqual({ width: 800, height: 600 });
	});
});

describe('toggleWindowListMaximized', () => {
	it('maximizes a normal window and stores restore bounds', () => {
		const next = toggleWindowListMaximized([seedWindow()], 'w1');
		expect(next[0]?.isMaximized).toBe(true);
		expect(next[0]?.position).toEqual({ x: 0, y: 0 });
		expect(next[0]?.size).toEqual({ width: 1200, height: 800 });
		expect(next[0]?.restoreBounds).toEqual({
			position: { x: 100, y: 80 },
			size: { width: 640, height: 480 },
		});
	});

	it('restores a maximized window clamped into work area (R15)', () => {
		const maximized = seedWindow({
			isMaximized: true,
			position: { x: 0, y: 0 },
			size: { width: 1200, height: 800 },
			restoreBounds: {
				position: { x: 100, y: 80 },
				size: { width: 640, height: 480 },
			},
		});
		const next = toggleWindowListMaximized([maximized], 'w1');
		expect(next[0]?.isMaximized).toBe(false);
		expect(next[0]?.position).toEqual({ x: 10, y: 10 });
		expect(next[0]?.size).toEqual({ width: 400, height: 300 });
		expect(next[0]?.restoreBounds).toBeNull();
	});
});

describe('syncMaximizedWindowsList', () => {
	it('returns the same array when maximized bounds already match', () => {
		const windows = [
			seedWindow({
				isMaximized: true,
				position: { x: 0, y: 0 },
				size: { width: 1200, height: 800 },
			}),
		];
		const bounds = {
			position: { x: 0, y: 0 },
			size: { width: 1200, height: 800 },
		};
		expect(syncMaximizedWindowsList(windows, bounds)).toBe(windows);
	});
});

describe('commitWindowsIntoWorkArea', () => {
	it('skips minimized windows and applies fit patch to visible ones', () => {
		const windows = [
			seedWindow({ id: 'visible' }),
			seedWindow({ id: 'minimized', isMinimized: true }),
		];
		const next = commitWindowsIntoWorkArea(windows, {
			width: 1200,
			height: 800,
		});
		expect(next[0]?.position).toEqual({ x: 10, y: 10 });
		expect(next[1]?.position).toEqual({ x: 100, y: 80 });
	});

	it('honors predicate when provided', () => {
		const windows = [seedWindow({ id: 'a' }), seedWindow({ id: 'b' })];
		const next = commitWindowsIntoWorkArea(
			windows,
			{ width: 1200, height: 800 },
			(window) => window.id === 'a'
		);
		expect(next[0]?.position).toEqual({ x: 10, y: 10 });
		expect(next[1]?.position).toEqual({ x: 100, y: 80 });
	});

	it('Wave 0: passes narrow work area into fit for Settings-sized window', async () => {
		const { fitWindowIntoWorkArea } = await import(
			'../../utils/desktopWindowGeometry'
		);
		const windows = [
			seedWindow({
				id: 'settings',
				appComponent: 'DesktopShellSettings',
				position: { x: 0, y: 0 },
				size: { width: 720, height: 560 },
			}),
		];
		const next = commitWindowsIntoWorkArea(
			windows,
			{ width: 390, height: 640 },
			(window) => !window.isMaximized && !window.isMinimized
		);
		expect(fitWindowIntoWorkArea).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'settings',
				size: { width: 720, height: 560 },
			}),
			{ width: 390, height: 640 },
			expect.anything()
		);
		expect(next[0]?.size).toEqual({ width: 400, height: 300 });
	});
});
