/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for taskbar window flyout dismiss policy (Escape vs Quest laser).
 */
import { describe, expect, it, vi } from 'vitest';
import {
	closeTaskbarWindowFlyouts,
	closeTaskbarWindowHoverFlyouts,
	dismissTaskbarLaserPointerHoverChrome,
	TASKBAR_WINDOW_FLYOUT_INITIAL,
} from '@/pages/Desktop/utils/desktopTaskbarWindowFlyoutDismiss';

describe('closeTaskbarWindowFlyouts', () => {
	it('clears overflow, group menu, and hover previews', () => {
		const current = {
			overflowMenuOpen: true,
			groupMenuOpen: 'group-a',
			hoveredWin: 'win-1',
			showPreviewForWin: 'win-1',
		};
		expect(closeTaskbarWindowFlyouts(current)).toEqual(
			TASKBAR_WINDOW_FLYOUT_INITIAL
		);
	});
});

describe('closeTaskbarWindowHoverFlyouts', () => {
	it('clears hover previews but keeps click toggles open', () => {
		const current = {
			overflowMenuOpen: true,
			groupMenuOpen: 'group-a',
			hoveredWin: 'win-1',
			showPreviewForWin: 'win-1',
		};
		expect(closeTaskbarWindowHoverFlyouts(current)).toEqual({
			overflowMenuOpen: true,
			groupMenuOpen: 'group-a',
			hoveredWin: null,
			showPreviewForWin: null,
		});
	});
});

describe('dismissTaskbarLaserPointerHoverChrome', () => {
	it('calls closeHoverFlyouts only', () => {
		const strip = {
			closeFlyouts: vi.fn(),
			closeHoverFlyouts: vi.fn(),
		};
		dismissTaskbarLaserPointerHoverChrome(strip);
		expect(strip.closeHoverFlyouts).toHaveBeenCalledTimes(1);
		expect(strip.closeFlyouts).not.toHaveBeenCalled();
	});

	it('no-ops when strip handle is missing', () => {
		expect(() => dismissTaskbarLaserPointerHoverChrome(null)).not.toThrow();
		expect(() =>
			dismissTaskbarLaserPointerHoverChrome(undefined)
		).not.toThrow();
	});
});
