/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes current desktop session hooks with shell performance bridge for settings panel and canvas.
 *
 * Invariants:
 * - Performance hints are read-only projections; toggles mutate only through optimizer setters.
 * - Continuous rAF FPS sampling runs **only** while Settings → Performance is open.
 * - Floating-widget canvas path never receives live FPS (stable QUIET stub) — otherwise ~1s
 *   metric publishes rebuild the whole desktop canvas (icons/background hit-target).
 *
 * Related:
 * - `hooks/useDesktopWorkspaceShellPerformanceBridge.ts`
 * - `hooks/usePerformanceOptimizer.ts`
 */

import type { DesktopControlCenterTab } from '../components/DesktopSettingsPanel';
import type { WindowInitialPayload, WindowState } from '../types/desktop.types';
import {
	type OpenDesktopAppByComponent,
	useDesktopWorkspaceCurrentDesktopSession,
} from './useDesktopWorkspaceCurrentDesktopSession';
import { useDesktopWorkspaceShellPerformanceBridge } from './useDesktopWorkspaceShellPerformanceBridge';

function isShellSettingsWindowOpenFromWindows(windows: WindowState[]): boolean {
	return (windows ?? []).some(
		(w) =>
			w.appComponent === 'DesktopShellSettings' &&
			!w.isMinimized &&
			!w.isMinimizing
	);
}

export function useDesktopWorkspaceActiveSessionAndPerformance(params: {
	windows: WindowState[];
	activeDesktopId: string;
	getWindowsOnDesktop: (desktopId: string) => string[] | undefined;
	focusWindow: (id: string) => void;
	closeWindow: (id: string) => void;
	minimizeWindow: (id: string) => void;
	setDesktopSettingsActiveTab: (tab: DesktopControlCenterTab) => void;
	openDesktopAppByComponent: OpenDesktopAppByComponent;
	desktopSettingsActiveTab: DesktopControlCenterTab;
	mergeShellSettingsWindowPayload: (patch: WindowInitialPayload) => void;
	/** Reserved for layout callers; does not enable FPS sampling (canvas isolation). */
	showDesktopWidget?: boolean;
}) {
	void params.showDesktopWidget;
	const settingsOpen = isShellSettingsWindowOpenFromWindows(params.windows);
	const frameSamplingEnabled =
		settingsOpen && params.desktopSettingsActiveTab === 'performance';

	const session = useDesktopWorkspaceCurrentDesktopSession({
		windows: params.windows,
		activeDesktopId: params.activeDesktopId,
		getWindowsOnDesktop: params.getWindowsOnDesktop,
		focusWindow: params.focusWindow,
		closeWindow: params.closeWindow,
		minimizeWindow: params.minimizeWindow,
		setDesktopSettingsActiveTab: params.setDesktopSettingsActiveTab,
		openDesktopAppByComponent: params.openDesktopAppByComponent,
		mergeShellSettingsWindowPayload: params.mergeShellSettingsWindowPayload,
		frameSamplingEnabled,
	});
	const {
		settingsPerformanceForPanel,
		floatingWidgetPerformanceForCanvas,
		autoQuietWindowLoad,
	} = useDesktopWorkspaceShellPerformanceBridge({
		performance: session.performance,
		currentDesktopWindows: session.currentDesktopWindows,
		isShellSettingsWindowOpen: session.isShellSettingsWindowOpen,
		desktopSettingsActiveTab: params.desktopSettingsActiveTab,
	});
	return {
		...session,
		settingsPerformanceForPanel,
		floatingWidgetPerformanceForCanvas,
		autoQuietWindowLoad,
	};
}
