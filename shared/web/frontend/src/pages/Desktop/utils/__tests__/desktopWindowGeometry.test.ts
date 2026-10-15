/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop window geometry helpers extracted from useWindowManager.
 *
 * Invariants:
 * - Snap patches stay aligned with desktopSnapGeometry zone rects.
 *
 * Related:
 * - `utils/desktopWindowGeometry.ts`, `hooks/useWindowManager.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WindowState } from '../../types/desktop.types';
import { readDesktopWorkArea } from '../desktopSnapGeometry';
import {
	buildSnapWindowStatePatch,
	fitWindowIntoWorkArea,
	getDefaultWindowCascadePosition,
	getDefaultWindowSize,
	getMaximizedWindowBounds,
	patchMaximizedWindowToWorkAreaBounds,
	resolveEffectiveWindowMinSize,
	resolveWindowRestoreBounds,
} from '../desktopWindowGeometry';

vi.mock('../desktopSnapGeometry', () => ({
	readDesktopWorkArea: vi.fn(() => ({
		offsetLeft: 0,
		offsetTop: 0,
		width: 1200,
		height: 800,
		layoutScale: 1,
	})),
	getRectForSnapZone: vi.fn(
		(zone: string, work: { width: number; height: number }) => {
			if (zone === 'left') {
				return {
					position: { x: 0, y: 0 },
					size: { width: work.width / 2, height: work.height },
					isMaximized: false,
				};
			}
			if (zone === 'top') {
				return {
					position: { x: 0, y: 0 },
					size: { width: work.width, height: work.height },
					isMaximized: true,
				};
			}
			throw new Error(`unexpected zone ${zone}`);
		}
	),
}));

function baseWindow(overrides: Partial<WindowState> = {}): WindowState {
	return {
		id: 'w1',
		title: 'Test',
		type: 'app',
		position: { x: 40, y: 60 },
		size: { width: 640, height: 480 },
		zIndex: 1,
		isMinimized: false,
		isMaximized: false,
		path: [],
		restoreBounds: null,
		...overrides,
	};
}

describe('desktopWindowGeometry', () => {
	it('cascades default open positions by window count index', () => {
		expect(getDefaultWindowCascadePosition(0)).toEqual({ x: 180, y: 100 });
		expect(getDefaultWindowCascadePosition(2)).toEqual({ x: 280, y: 200 });
	});

	it('derives default app size from mocked work area', () => {
		expect(getDefaultWindowSize('app')).toEqual({ width: 580, height: 456 });
		expect(getDefaultWindowSize('folder')).toEqual({ width: 580, height: 450 });
	});

	it('derives maximized bounds from mocked work area', () => {
		expect(getMaximizedWindowBounds()).toEqual({
			position: { x: 0, y: 0 },
			size: { width: 1200, height: 800 },
		});
	});

	it('centers restore bounds when snapshot restoreBounds is missing', () => {
		const workSize = { width: 1200, height: 800 };
		const bounds = resolveWindowRestoreBounds(
			{ type: 'app', appComponent: undefined, restoreBounds: null },
			workSize
		);
		expect(bounds.size).toEqual({ width: 580, height: 456 });
		expect(bounds.position.x).toBe(310);
		expect(bounds.position.y).toBe(172);
	});

	it('preserves explicit restoreBounds', () => {
		const saved = {
			position: { x: 12, y: 34 },
			size: { width: 700, height: 500 },
		};
		expect(
			resolveWindowRestoreBounds(
				{ type: 'app', appComponent: undefined, restoreBounds: saved },
				{ width: 1200, height: 800 }
			)
		).toEqual(saved);
	});

	it('builds snap patch and keeps prior restoreBounds when already maximized', () => {
		const window = baseWindow({
			isMaximized: true,
			restoreBounds: {
				position: { x: 10, y: 20 },
				size: { width: 300, height: 200 },
			},
			position: { x: 0, y: 0 },
			size: { width: 1200, height: 800 },
		});
		const patch = buildSnapWindowStatePatch(window, 'left', {
			width: 1200,
			height: 800,
		});
		expect(patch).toMatchObject({
			position: { x: 0, y: 0 },
			size: { width: 600, height: 800 },
			isMaximized: false,
			isMinimized: false,
			restoreBounds: window.restoreBounds,
		});
	});

	it('captures pre-snap bounds when snapping a normal window', () => {
		const window = baseWindow();
		const patch = buildSnapWindowStatePatch(window, 'left', {
			width: 1200,
			height: 800,
		});
		expect(patch.restoreBounds).toEqual({
			position: window.position,
			size: window.size,
		});
	});

	it('returns null when maximized window already matches work-area bounds', () => {
		const bounds = getMaximizedWindowBounds();
		const window = baseWindow({
			isMaximized: true,
			position: bounds.position,
			size: bounds.size,
		});
		expect(patchMaximizedWindowToWorkAreaBounds(window, bounds)).toBeNull();
	});

	it('clamps oversized windows into work area', () => {
		const window = baseWindow({
			position: { x: 900, y: 700 },
			size: { width: 900, height: 700 },
		});
		const patch = fitWindowIntoWorkArea(
			window,
			{ width: 1000, height: 600 },
			{ minWidth: 320, minHeight: 240 }
		);
		expect(patch.position.x).toBeLessThanOrEqual(1000 - 320);
		expect(patch.position.y).toBeLessThanOrEqual(600 - 240);
		expect(patch.size.width).toBeLessThanOrEqual(1000);
		expect(patch.size.height).toBeLessThanOrEqual(600);
	});

	it('un-maximizes and clamps when fitting a maximized window', () => {
		const window = baseWindow({
			isMaximized: true,
			position: { x: 0, y: 0 },
			size: { width: 1200, height: 800 },
			restoreBounds: {
				position: { x: 2000, y: 1500 },
				size: { width: 900, height: 700 },
			},
		});
		const patch = fitWindowIntoWorkArea(
			window,
			{ width: 1000, height: 600 },
			{ minWidth: 320, minHeight: 240 }
		);
		expect(patch.isMaximized).toBe(false);
		expect(patch.restoreBounds).toBeNull();
		expect(patch.position.x).toBe(100);
		expect(patch.size.width).toBe(900);
	});
});

describe('P4 / L6 work-area viewport clamp', () => {
	beforeEach(() => {
		vi.mocked(readDesktopWorkArea).mockReturnValue({
			offsetLeft: 0,
			offsetTop: 0,
			width: 1200,
			height: 800,
			layoutScale: 1,
		});
	});

	it('caps registered min-size by narrow work area', () => {
		const effective = resolveEffectiveWindowMinSize(
			{ minWidth: 720, minHeight: 520 },
			{ width: 390, height: 640 }
		);
		expect(effective.minWidth).toBeLessThanOrEqual(390);
		expect(effective.minHeight).toBeLessThanOrEqual(640);
		expect(effective.minWidth).toBeGreaterThanOrEqual(200);
	});

	it('narrow work-area open geometry ⊆ work area (Settings-sized tier)', () => {
		vi.mocked(readDesktopWorkArea).mockReturnValue({
			offsetLeft: 0,
			offsetTop: 0,
			width: 390,
			height: 640,
			layoutScale: 1,
		});
		const size = getDefaultWindowSize('app', 'DesktopShellSettings');
		expect(size.width).toBeLessThanOrEqual(390);
		expect(size.height).toBeLessThanOrEqual(640);
		// Soft floor must not force 720 when work area is narrower.
		expect(size.width).toBe(390);

		const window = baseWindow({
			appComponent: 'DesktopShellSettings',
			position: { x: 0, y: 0 },
			size: { width: 720, height: 560 },
		});
		const patch = fitWindowIntoWorkArea(
			window,
			{ width: 390, height: 640 },
			{ minWidth: 720, minHeight: 520 }
		);
		expect(patch.size.width).toBeLessThanOrEqual(390);
		expect(patch.size.height).toBeLessThanOrEqual(640);
		expect(patch.position.x).toBeGreaterThanOrEqual(0);
		expect(patch.position.y).toBeGreaterThanOrEqual(0);
	});
});
