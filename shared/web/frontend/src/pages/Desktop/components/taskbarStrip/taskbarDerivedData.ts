/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers + memoized strip inputs for Taskbar: pinned badge totals,
 * desktop app ids, and flat/group window partition for the pinned strip.
 *
 * Invariants:
 * - When TASKBAR_GROUP_BY_APP is on, overflow partition is skipped (empty overflow).
 * - Flat path uses partitionTaskbarWindowsForStrip (7 visible slots + titled overflow).
 *
 * Related:
 * - Taskbar.tsx
 * - taskbarStripHelpers.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { useMemo } from 'react';
import { DESKTOP_FEATURE_FLAGS } from '@/pages/Desktop/constants';
import { getTaskbarPinnedApps } from '@/pages/Desktop/utils/taskbarPinnedOrder';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	isFriendsAppBadge,
	isGafChatAppBadge,
	partitionTaskbarWindowsForStrip,
} from './taskbarStripHelpers';

export function taskbarWindowGroupKey(w: WindowState): string {
	return w.folderId ?? w.appComponent ?? w.id;
}

export type TaskbarWindowStripItem = {
	key: string;
	windows: WindowState[];
};

export type TaskbarDerivedStripData = {
	pinnedApps: DesktopItem[];
	pinnedGafChatBadgeActive: boolean;
	pinnedFriendsBadgeActive: boolean;
	pinnedAppsBadgeTotal: number;
	desktopAppIds: string[];
	taskbarWindowItems: TaskbarWindowStripItem[];
	overflowWindows: WindowState[];
	hasOverflow: boolean;
};

export function buildTaskbarWindowStripItems(
	windows: WindowState[]
): Pick<
	TaskbarDerivedStripData,
	'taskbarWindowItems' | 'overflowWindows' | 'hasOverflow'
> {
	if (DESKTOP_FEATURE_FLAGS.TASKBAR_GROUP_BY_APP) {
		const map = new Map<string, WindowState[]>();
		for (const w of windows) {
			const k = taskbarWindowGroupKey(w);
			if (!map.has(k)) map.set(k, []);
			map.get(k)?.push(w);
		}
		const items = Array.from(map.entries()).map(([key, wins]) => ({
			key,
			windows: wins,
		}));
		return {
			taskbarWindowItems: items,
			overflowWindows: [],
			hasOverflow: false,
		};
	}

	const partition = partitionTaskbarWindowsForStrip(windows);
	return {
		taskbarWindowItems: partition.visibleWindows.map((w) => ({
			key: w.id,
			windows: [w],
		})),
		overflowWindows: partition.overflowWindows,
		hasOverflow: partition.hasOverflow,
	};
}

export function useTaskbarDerivedStripData(args: {
	apps: DesktopItem[];
	desktopItems: DesktopItem[];
	windows: WindowState[];
	appBadgeCounts?: Record<string, number>;
}): TaskbarDerivedStripData {
	const { apps, desktopItems, windows, appBadgeCounts } = args;

	const pinnedApps = useMemo(() => getTaskbarPinnedApps(apps), [apps]);

	const pinnedGafChatBadgeActive = useMemo(
		() =>
			pinnedApps.some(
				(app) =>
					isGafChatAppBadge(app.appComponent) &&
					(appBadgeCounts?.[app.id] ?? 0) > 0
			),
		[appBadgeCounts, pinnedApps]
	);

	const pinnedFriendsBadgeActive = useMemo(
		() =>
			pinnedApps.some(
				(app) =>
					isFriendsAppBadge(app.appComponent) &&
					(appBadgeCounts?.[app.id] ?? 0) > 0
			),
		[appBadgeCounts, pinnedApps]
	);

	const pinnedAppsBadgeTotal = useMemo(
		() =>
			pinnedApps.reduce((sum, app) => sum + (appBadgeCounts?.[app.id] ?? 0), 0),
		[appBadgeCounts, pinnedApps]
	);

	const desktopAppIds = useMemo(
		() =>
			desktopItems
				.filter((item) => item.type === 'app' && !item.parentId)
				.map((item) => item.id),
		[desktopItems]
	);

	const { taskbarWindowItems, overflowWindows, hasOverflow } = useMemo(
		() => buildTaskbarWindowStripItems(windows),
		[windows]
	);

	return {
		pinnedApps,
		pinnedGafChatBadgeActive,
		pinnedFriendsBadgeActive,
		pinnedAppsBadgeTotal,
		desktopAppIds,
		taskbarWindowItems,
		overflowWindows,
		hasOverflow,
	};
}
