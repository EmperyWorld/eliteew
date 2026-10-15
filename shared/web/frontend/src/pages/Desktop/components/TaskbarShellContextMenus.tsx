/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portal context menus for the desktop taskbar: window button, Start button,
 * and empty-taskbar background. Presentational only — open state owned by Taskbar.
 *
 * Invariants:
 * - Menus mount via ShellPortalMount with desktop portal z-index base.
 * - Escape dismiss is owned by useDismissibleFloatingMenu in Taskbar (not here).
 *
 * Related:
 * - Taskbar.tsx
 * - DesktopAppChrome.tsx
 */

import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, m } from 'framer-motion';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE, DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import type { VirtualDesktop } from '../hooks/useVirtualDesktops';
import type { WindowState } from '../types/desktop.types';
import {
	DesktopAppContextMenuTitle,
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSectionLabel,
	DesktopAppMenuSurface,
} from './DesktopAppChrome';
import { DESKTOP_WINDOW_CHROME_SHARED_ACTIONS } from '../utils/desktopWindowChromeActions';

export type TaskbarWinContextMenuState = {
	windowId: string;
	x: number;
	y: number;
} | null;

export type TaskbarPointContextMenuState = { x: number; y: number } | null;

export type TaskbarShellContextMenusProps = {
	portalStackBase: number;
	winContextMenu: TaskbarWinContextMenuState;
	startContextMenu: TaskbarPointContextMenuState;
	taskbarContextMenu: TaskbarPointContextMenuState;
	winContextMenuRef: RefObject<HTMLDivElement | null>;
	startContextMenuRef: RefObject<HTMLDivElement | null>;
	taskbarContextMenuRef: RefObject<HTMLDivElement | null>;
	adjustedWinContextMenu: { x: number; y: number } | null;
	adjustedStartContextMenu: { x: number; y: number } | null;
	adjustedTaskbarContextMenu: { x: number; y: number } | null;
	contextWindow: WindowState | null;
	contextWindowTitle: string;
	otherDesktops: VirtualDesktop[];
	moveWindowToDesktop?: (windowId: string, desktopId: string) => void;
	onFocusWindow?: (id: string) => void;
	onWinClick: (id: string) => void;
	onMinimizeWindow?: (id: string) => void;
	onToggleMaximizeWindow?: (id: string) => void;
	onCloseWindow?: (id: string) => void;
	onWallpaper?: () => void;
	showStart: boolean;
	setShowStart: Dispatch<SetStateAction<boolean>>;
	setShowNotifications: Dispatch<SetStateAction<boolean>>;
	setShowTray: Dispatch<SetStateAction<boolean>>;
	setWinContextMenu: Dispatch<SetStateAction<TaskbarWinContextMenuState>>;
	setStartContextMenu: Dispatch<SetStateAction<TaskbarPointContextMenuState>>;
	setTaskbarContextMenu: Dispatch<SetStateAction<TaskbarPointContextMenuState>>;
};

export function TaskbarShellContextMenus({
	portalStackBase,
	winContextMenu,
	startContextMenu,
	taskbarContextMenu,
	winContextMenuRef,
	startContextMenuRef,
	taskbarContextMenuRef,
	adjustedWinContextMenu,
	adjustedStartContextMenu,
	adjustedTaskbarContextMenu,
	contextWindow,
	contextWindowTitle,
	otherDesktops,
	moveWindowToDesktop,
	onFocusWindow,
	onWinClick,
	onMinimizeWindow,
	onToggleMaximizeWindow,
	onCloseWindow,
	onWallpaper,
	showStart,
	setShowStart,
	setShowNotifications,
	setShowTray,
	setWinContextMenu,
	setStartContextMenu,
	setTaskbarContextMenu,
}: TaskbarShellContextMenusProps) {
	const { t } = useTranslation('desktopUi');
	const [
		chromeRestoreOrFocus,
		chromeMinimize,
		chromeMaximizeOrRestore,
		chromeClose,
		chromeMoveToDesktop,
	] = DESKTOP_WINDOW_CHROME_SHARED_ACTIONS;

	return (
		<ShellPortalMount>
			{/* Window button context menu */}
			<AnimatePresence>
				{winContextMenu && contextWindow && (
					<m.div
						ref={winContextMenuRef}
						initial={{ opacity: 0, scale: 0.96, y: 4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 4 }}
						transition={{ duration: 0.12 }}
						className="fixed"
						style={{
							zIndex: portalStackBase,
							left: adjustedWinContextMenu?.x ?? winContextMenu.x,
							top: adjustedWinContextMenu?.y ?? winContextMenu.y - 8,
						}}
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
						onContextMenu={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}
					>
						<DesktopAppMenuSurface
							className="min-w-61"
							role="menu"
							aria-label={t('windowContextMenu.ariaLabel', {
								title: contextWindowTitle,
							})}
						>
							<DesktopAppContextMenuTitle className="truncate">
								{contextWindowTitle}
							</DesktopAppContextMenuTitle>
							<div className="py-1">
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									data-desktop-window-chrome-action={chromeRestoreOrFocus}
									onClick={() => {
										(onFocusWindow ?? onWinClick)(contextWindow.id);
										setWinContextMenu(null);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{contextWindow.isMinimized
										? t('windowContextMenu.restore')
										: t('windowContextMenu.bringToFront')}
								</DesktopAppMenuItem>
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									data-desktop-window-chrome-action={chromeMinimize}
									disabled={contextWindow.isMinimized || !onMinimizeWindow}
									onClick={() => {
										onMinimizeWindow?.(contextWindow.id);
										setWinContextMenu(null);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('windowContextMenu.minimize')}
								</DesktopAppMenuItem>
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									data-desktop-window-chrome-action={chromeMaximizeOrRestore}
									disabled={
										contextWindow.isMinimized || !onToggleMaximizeWindow
									}
									onClick={() => {
										onToggleMaximizeWindow?.(contextWindow.id);
										setWinContextMenu(null);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{contextWindow.isMaximized
										? t('windowContextMenu.restore')
										: t('windowContextMenu.maximize')}
								</DesktopAppMenuItem>
								{otherDesktops.length > 0 && moveWindowToDesktop ? (
									<>
										<DesktopAppMenuDivider />
										<DesktopAppMenuSectionLabel>
											{t('taskbar.moveToDesktop')}
										</DesktopAppMenuSectionLabel>
										{otherDesktops.map((d) => (
											<DesktopAppMenuItem
												key={d.id}
												type="button"
												role="menuitem"
												data-desktop-window-chrome-action={chromeMoveToDesktop}
												icon={
													<ComputerDesktopIcon
														className="h-4 w-4"
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												}
												onClick={() => {
													moveWindowToDesktop(contextWindow.id, d.id);
													setWinContextMenu(null);
												}}
												className={DESKTOP_INTERACTIVE.focusRing}
											>
												{d.name}
											</DesktopAppMenuItem>
										))}
									</>
								) : null}
								<DesktopAppMenuDivider />
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									tone="danger"
									data-desktop-window-chrome-action={chromeClose}
									disabled={!onCloseWindow}
									onClick={() => {
										onCloseWindow?.(contextWindow.id);
										setWinContextMenu(null);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('windowContextMenu.close')}
								</DesktopAppMenuItem>
							</div>
						</DesktopAppMenuSurface>
					</m.div>
				)}
			</AnimatePresence>

			{/* Start button context menu */}
			<AnimatePresence>
				{startContextMenu && (
					<m.div
						ref={startContextMenuRef}
						initial={{ opacity: 0, scale: 0.96, y: 4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 4 }}
						transition={{ duration: 0.12 }}
						className="fixed"
						style={{
							zIndex: portalStackBase,
							left: adjustedStartContextMenu?.x ?? startContextMenu.x,
							top: adjustedStartContextMenu?.y ?? startContextMenu.y,
						}}
					>
						<DesktopAppMenuSurface
							className="min-w-50"
							role="menu"
							aria-label={t('taskbar.startContextLabel')}
						>
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									setShowStart((v) => !v);
									setStartContextMenu(null);
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{showStart ? t('taskbar.closeStart') : t('taskbar.openStart')}
							</DesktopAppMenuItem>
						</DesktopAppMenuSurface>
					</m.div>
				)}
			</AnimatePresence>

			{/* Taskbar background context menu */}
			<AnimatePresence>
				{taskbarContextMenu && (
					<m.div
						ref={taskbarContextMenuRef}
						initial={{ opacity: 0, scale: 0.96, y: 4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 4 }}
						transition={{ duration: 0.12 }}
						className="fixed"
						style={{
							zIndex: portalStackBase,
							left: adjustedTaskbarContextMenu?.x ?? taskbarContextMenu.x,
							top: adjustedTaskbarContextMenu?.y ?? taskbarContextMenu.y,
						}}
					>
						<DesktopAppMenuSurface
							className="min-w-57"
							role="menu"
							aria-label={t('taskbar.backgroundContextLabel')}
						>
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									window.dispatchEvent(new CustomEvent('desktop-show-desktop'));
									setTaskbarContextMenu(null);
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('taskbar.showDesktop')}
							</DesktopAppMenuItem>
							<DesktopAppMenuDivider />
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									setShowNotifications((prev) => {
										const next = !prev;
										if (next) {
											setShowTray(false);
											setShowStart(false);
										}
										return next;
									});
									setTaskbarContextMenu(null);
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('taskbar.notificationCenter')}
							</DesktopAppMenuItem>
							{onWallpaper ? (
								<DesktopAppMenuItem
									type="button"
									role="menuitem"
									onClick={() => {
										onWallpaper();
										setTaskbarContextMenu(null);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('taskbar.wallpaperMenu')}
								</DesktopAppMenuItem>
							) : null}
						</DesktopAppMenuSurface>
					</m.div>
				)}
			</AnimatePresence>
		</ShellPortalMount>
	);
}
