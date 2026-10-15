/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for pinned-apps island + window overflow strip on the taskbar.
 * Composes extracted modules under `taskbarStrip/` and re-exports dense partition helpers.
 *
 * Invariants:
 * - `closeFlyouts()` resets window overflow/group/pinned modal via child refs.
 * - Public import path `./TaskbarPinnedAndWindowsStrip` remains stable for Taskbar and tests.
 *
 * Related:
 * - `Taskbar.tsx`
 * - `taskbarStrip/TaskbarPinnedMenuIsland.tsx`
 * - `taskbarStrip/TaskbarWindowsOverflowStrip.tsx`
 */

import { themeDesignTokens } from '@/theme/designTokens';
import type { Variants } from 'framer-motion';
import { forwardRef, memo, useImperativeHandle, useRef } from 'react';
import type { DesktopIconStyle, DesktopWindowStyle } from '@/types/profile';
import type { OpenWindowOptions } from '../hooks/useWindowManager';
import type { DesktopItem, WindowState } from '../types/desktop.types';
import {
	TaskbarPinnedMenuIsland,
	type TaskbarPinnedMenuIslandHandle,
} from './taskbarStrip/TaskbarPinnedMenuIsland';
import {
	TaskbarWindowsOverflowStrip,
	type TaskbarWindowsOverflowStripHandle,
} from './taskbarStrip/TaskbarWindowsOverflowStrip';
import {
	partitionTaskbarWindowsForStrip,
	shouldUseDenseTaskbarWindowMode,
	TASKBAR_DENSE_WINDOW_COUNT,
	TASKBAR_VISIBLE_WINDOW_SLOTS,
} from './taskbarStrip/taskbarStripHelpers';

export {
	TASKBAR_DENSE_WINDOW_COUNT,
	TASKBAR_VISIBLE_WINDOW_SLOTS,
	shouldUseDenseTaskbarWindowMode,
	partitionTaskbarWindowsForStrip,
};

export type TaskbarPinnedAndWindowsStripHandle = {
	closeFlyouts: () => void;
	/** Hover-only: window previews / tooltips — not Start / pinned / tray toggles. */
	closeHoverFlyouts: () => void;
};

export type TaskbarPinnedAndWindowsStripProps = {
	taskbarDividerClass: string;
	taskbarButtonSurface: string;
	taskbarButtonActiveSurface: string;
	/** Кнопка «Закреплённые» — без окантовки пресета, как иконки справа (трей/часы). */
	pinnedMenuButtonSurface: string;
	pinnedMenuButtonActiveSurface: string;
	buttonVariants: Variants;
	shellPanel: string;
	/** Пресет «стиль окон» — палитра панели «Все закреплённые». */
	shellWindowStyle?: DesktopWindowStyle;
	apps: DesktopItem[];
	/** Все окна рабочего стола (для модалки закреплённых). */
	windows: WindowState[];
	iconStyle: DesktopIconStyle;
	appBadgeCounts?: Record<string, number>;
	activeWindowId?: string | null;
	onWinClick: (id: string) => void;
	onOpenApp: (app: DesktopItem, options?: OpenWindowOptions) => void;
	desktopAppIds?: string[];
	onPinAppToDesktop?: (app: DesktopItem) => void;
	onUnpinAppFromDesktop?: (app: DesktopItem) => void;
	setWinContextMenu: (
		v: { windowId: string; x: number; y: number } | null
	) => void;
	pinnedApps: DesktopItem[];
	pinnedAppsBadgeTotal: number;
	pinnedFriendsBadgeActive: boolean;
	pinnedGafChatBadgeActive: boolean;
	taskbarWindowItems: { key: string; windows: WindowState[] }[];
	overflowWindows: WindowState[];
	hasOverflow: boolean;
	/** Framer/OS «reduce motion»: короче анимации модалки закреплённых. */
	preferReducedMotion?: boolean;
};

const TaskbarPinnedAndWindowsStripInner = forwardRef<
	TaskbarPinnedAndWindowsStripHandle,
	TaskbarPinnedAndWindowsStripProps
>(function TaskbarPinnedAndWindowsStripInner(
	{
		taskbarDividerClass,
		taskbarButtonSurface,
		taskbarButtonActiveSurface,
		pinnedMenuButtonSurface,
		pinnedMenuButtonActiveSurface,
		buttonVariants,
		shellPanel,
		shellWindowStyle = 'glass',
		apps,
		windows,
		iconStyle,
		appBadgeCounts,
		activeWindowId = null,
		onWinClick,
		onOpenApp,
		desktopAppIds = [],
		onPinAppToDesktop,
		onUnpinAppFromDesktop,
		setWinContextMenu,
		pinnedApps,
		pinnedAppsBadgeTotal,
		pinnedFriendsBadgeActive,
		pinnedGafChatBadgeActive,
		taskbarWindowItems,
		overflowWindows,
		hasOverflow,
		preferReducedMotion = false,
	},
	ref
) {
	const { taskbar } = themeDesignTokens.desktop;
	const pinnedRef = useRef<TaskbarPinnedMenuIslandHandle>(null);
	const windowsRef = useRef<TaskbarWindowsOverflowStripHandle>(null);

	useImperativeHandle(ref, () => ({
		closeFlyouts: () => {
			windowsRef.current?.closeFlyouts();
			pinnedRef.current?.closePinnedMenu();
		},
		closeHoverFlyouts: () => {
			windowsRef.current?.closeHoverFlyouts();
		},
	}));

	return (
		<div
			data-desktop-welcome-guide="windows"
			className={`flex-1 min-h-0 min-w-0 max-w-full overflow-hidden flex items-stretch ${taskbar.GAP}`}
		>
			<div
				className={`flex h-full min-h-full min-w-0 w-full flex-nowrap items-center ${taskbar.GAP}`}
			>
				<TaskbarPinnedMenuIsland
					ref={pinnedRef}
					taskbarDividerClass={taskbarDividerClass}
					pinnedMenuButtonSurface={pinnedMenuButtonSurface}
					pinnedMenuButtonActiveSurface={pinnedMenuButtonActiveSurface}
					buttonVariants={buttonVariants}
					shellWindowStyle={shellWindowStyle}
					pinnedApps={pinnedApps}
					pinnedAppsBadgeTotal={pinnedAppsBadgeTotal}
					pinnedFriendsBadgeActive={pinnedFriendsBadgeActive}
					pinnedGafChatBadgeActive={pinnedGafChatBadgeActive}
					windows={windows}
					iconStyle={iconStyle}
					appBadgeCounts={appBadgeCounts}
					onWinClick={onWinClick}
					onOpenApp={onOpenApp}
					desktopAppIds={desktopAppIds}
					onPinAppToDesktop={onPinAppToDesktop}
					onUnpinAppFromDesktop={onUnpinAppFromDesktop}
					preferReducedMotion={preferReducedMotion}
				/>
				<TaskbarWindowsOverflowStrip
					ref={windowsRef}
					taskbarButtonSurface={taskbarButtonSurface}
					taskbarButtonActiveSurface={taskbarButtonActiveSurface}
					buttonVariants={buttonVariants}
					shellPanel={shellPanel}
					apps={apps}
					iconStyle={iconStyle}
					appBadgeCounts={appBadgeCounts}
					activeWindowId={activeWindowId}
					onWinClick={onWinClick}
					setWinContextMenu={setWinContextMenu}
					taskbarWindowItems={taskbarWindowItems}
					overflowWindows={overflowWindows}
					hasOverflow={hasOverflow}
				/>
			</div>
		</div>
	);
});

TaskbarPinnedAndWindowsStripInner.displayName = 'TaskbarPinnedAndWindowsStrip';

export const TaskbarPinnedAndWindowsStrip = memo(
	TaskbarPinnedAndWindowsStripInner
);
