/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * openShellSettings closes Start Menu via requestCloseStartMenu before focusing/opening settings.
 *
 * Related:
 * - ../useDesktopWorkspaceCurrentDesktopSession.ts
 * - ../../utils/desktopDeepLink.ts
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_CLOSE_START_MENU_EVENT } from '../../utils/desktopDeepLink';
import { useDesktopWorkspaceCurrentDesktopSession } from '../useDesktopWorkspaceCurrentDesktopSession';

vi.mock('../../runtime/DesktopBackgroundRuntimeContext', () => ({
	useDesktopBackgroundRuntimeMetrics: () => ({}),
}));

vi.mock('../usePerformanceOptimizer', () => ({
	usePerformanceOptimizer: () => ({
		preferAggressiveBackgroundSuspend: false,
	}),
}));

describe('useDesktopWorkspaceCurrentDesktopSession openShellSettings', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('dispatches DESKTOP_CLOSE_START_MENU_EVENT before opening settings', () => {
		const closeSpy = vi.fn();
		window.addEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeSpy);
		const openDesktopAppByComponent = vi.fn();
		const setDesktopSettingsActiveTab = vi.fn();
		const focusWindow = vi.fn();
		const mergeShellSettingsWindowPayload = vi.fn();

		const { result } = renderHook(() =>
			useDesktopWorkspaceCurrentDesktopSession({
				windows: [],
				activeDesktopId: 'vd-1',
				getWindowsOnDesktop: () => [],
				focusWindow,
				closeWindow: vi.fn(),
				minimizeWindow: vi.fn(),
				setDesktopSettingsActiveTab,
				openDesktopAppByComponent,
				mergeShellSettingsWindowPayload,
			})
		);

		result.current.openShellSettings('chrome');

		expect(closeSpy).toHaveBeenCalledTimes(1);
		expect(setDesktopSettingsActiveTab).toHaveBeenCalledWith('chrome');
		expect(openDesktopAppByComponent).toHaveBeenCalledWith(
			'DesktopShellSettings',
			expect.objectContaining({
				initialPayload: expect.objectContaining({ shellSettingsTab: 'chrome' }),
			})
		);

		window.removeEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeSpy);
	});

	it('closes Start Menu even when focusing an existing settings window', () => {
		const closeSpy = vi.fn();
		window.addEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeSpy);
		const focusWindow = vi.fn();
		const openDesktopAppByComponent = vi.fn();

		const existing = {
			id: 'win-settings',
			appComponent: 'DesktopShellSettings',
			zIndex: 10,
			isMinimized: false,
			isMinimizing: false,
		};

		const { result } = renderHook(() =>
			useDesktopWorkspaceCurrentDesktopSession({
				windows: [existing as never],
				activeDesktopId: 'vd-1',
				getWindowsOnDesktop: () => ['win-settings'],
				focusWindow,
				closeWindow: vi.fn(),
				minimizeWindow: vi.fn(),
				setDesktopSettingsActiveTab: vi.fn(),
				openDesktopAppByComponent,
				mergeShellSettingsWindowPayload: vi.fn(),
			})
		);

		result.current.openShellSettings('personalize');

		expect(closeSpy).toHaveBeenCalledTimes(1);
		expect(focusWindow).toHaveBeenCalledWith('win-settings');
		expect(openDesktopAppByComponent).not.toHaveBeenCalled();

		window.removeEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeSpy);
	});
});
