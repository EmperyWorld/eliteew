/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared taskbar strip helpers: dense mode threshold, visible slot cap,
 * window title, source app resolution.
 *
 * Invariants:
 * - Dense mode implies overflow: excess windows go to a titled overflow menu
 *   (never icon-only strip with an empty overflow list).
 *
 * Related:
 * - `TaskbarPinnedAndWindowsStrip.tsx`
 * - `Taskbar.tsx`
 */

import type { DesktopItem, WindowState } from '../../types/desktop.types';
import { findDesktopAppItemByComponent } from '../../utils/desktopAppRegistry';
import {
	resolveDesktopWindowDisplayTitle,
	withEwaDesktopItemDisplayName,
} from '../../utils/desktopWindowDisplayTitle';

/** Visible window buttons in the strip before overflow (dense). */
export const TASKBAR_VISIBLE_WINDOW_SLOTS = 7;

/**
 * Dense (icon-compact) strip starts when count exceeds visible slots.
 * Alias kept for callers/tests that used the old threshold name.
 */
export const TASKBAR_DENSE_WINDOW_COUNT = TASKBAR_VISIBLE_WINDOW_SLOTS + 1;

export function shouldUseDenseTaskbarWindowMode(windowCount: number): boolean {
	return windowCount > TASKBAR_VISIBLE_WINDOW_SLOTS;
}

export type TaskbarWindowStripPartition = {
	visibleWindows: WindowState[];
	overflowWindows: WindowState[];
	hasOverflow: boolean;
	dense: boolean;
};

/**
 * Partition open windows into strip slots + titled overflow list.
 * Non-group mode: when dense, strip shows first N windows; rest are named in overflow.
 */
export function partitionTaskbarWindowsForStrip(
	windows: WindowState[]
): TaskbarWindowStripPartition {
	const dense = shouldUseDenseTaskbarWindowMode(windows.length);
	if (!dense) {
		return {
			visibleWindows: windows,
			overflowWindows: [],
			hasOverflow: false,
			dense: false,
		};
	}
	const visibleWindows = windows.slice(0, TASKBAR_VISIBLE_WINDOW_SLOTS);
	const overflowWindows = windows.slice(TASKBAR_VISIBLE_WINDOW_SLOTS);
	return {
		visibleWindows,
		overflowWindows,
		hasOverflow: overflowWindows.length > 0,
		dense: true,
	};
}

export function isFriendsAppBadge(appComponent?: string | null): boolean {
	return appComponent === 'FriendsApp' || appComponent === 'SocialHubApp';
}

export function isGafChatAppBadge(appComponent?: string | null): boolean {
	return appComponent === 'GAFChatApp';
}

export function getTaskbarWindowTitle(win: WindowState): string {
	return resolveDesktopWindowDisplayTitle(win);
}

export function resolveWindowSourceApp(
	apps: DesktopItem[],
	desktopWindow: WindowState
): DesktopItem | undefined {
	const hit =
		apps.find((app) => app.id === desktopWindow.folderId) ??
		(desktopWindow.appComponent
			? findDesktopAppItemByComponent(apps, desktopWindow.appComponent)
			: undefined);
	return hit ? withEwaDesktopItemDisplayName(hit, [desktopWindow]) : undefined;
}
