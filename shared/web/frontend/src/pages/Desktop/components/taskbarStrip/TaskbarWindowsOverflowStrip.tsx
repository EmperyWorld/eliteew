/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar window buttons, group menus, hover previews, and dense overflow strip.
 *
 * Invariants:
 * - Window buttons use left click for focus/minimize toggle; ПКМ delegates to Taskbar window context menu.
 * - Dense mode uses icon-compact slots with titled overflow menu for excess windows.
 *
 * Related:
 * - `TaskbarPinnedAndWindowsStrip.tsx`
 * - `taskbarStripHelpers.ts`
 * - `TaskbarWindowPreviewFlyout.tsx`
 */

import { themeDesignTokens } from '@/theme/designTokens';
import { cn } from '@/utils/cn';
import { AnimatePresence, m, type Variants } from 'framer-motion';
import {
	forwardRef,
	memo,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopIconStyle } from '@/types/profile';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TOOLTIP,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import { preloadDesktopApp } from '../../utils/preloadDesktopApp';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import { useDesktopShellMotionPrefs } from '../../context/DesktopShellMotionPrefsContext';
import { useFinePointerHover } from '../../hooks/useFinePointerHover';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { DesktopWindowMorphChip } from '../DesktopWindowMorphChip';
import { TaskbarCountBadge } from '../TaskbarCountBadge';
import { TaskbarWindowPreviewFlyout } from './TaskbarWindowPreviewFlyout';
import {
	getTaskbarWindowTitle,
	isFriendsAppBadge,
	isGafChatAppBadge,
	resolveWindowSourceApp,
	shouldUseDenseTaskbarWindowMode,
} from './taskbarStripHelpers';
import { ChevronUpIcon } from '@heroicons/react/24/outline';

export type TaskbarWindowsOverflowStripHandle = {
	closeFlyouts: () => void;
	closeHoverFlyouts: () => void;
};

export type TaskbarWindowsOverflowStripProps = {
	taskbarButtonSurface: string;
	taskbarButtonActiveSurface: string;
	buttonVariants: Variants;
	shellPanel: string;
	apps: DesktopItem[];
	iconStyle: DesktopIconStyle;
	appBadgeCounts?: Record<string, number>;
	activeWindowId?: string | null;
	onWinClick: (id: string) => void;
	setWinContextMenu: (
		v: { windowId: string; x: number; y: number } | null
	) => void;
	taskbarWindowItems: { key: string; windows: WindowState[] }[];
	overflowWindows: WindowState[];
	hasOverflow: boolean;
};

export const TaskbarWindowsOverflowStrip = memo(
	forwardRef<
		TaskbarWindowsOverflowStripHandle,
		TaskbarWindowsOverflowStripProps
	>(function TaskbarWindowsOverflowStrip(
		{
			taskbarButtonSurface,
			taskbarButtonActiveSurface,
			buttonVariants,
			shellPanel,
			apps,
			iconStyle,
			appBadgeCounts,
			activeWindowId = null,
			onWinClick,
			setWinContextMenu,
			taskbarWindowItems,
			overflowWindows,
			hasOverflow,
		},
		ref
	) {
		const { t } = useTranslation('desktopUi');
		const { reduceMotion } = useDesktopShellMotionPrefs();
		const portalStackBase = useDesktopWindowPortalStackBase();
		const { taskbar } = themeDesignTokens.desktop;
		const finePointerHover = useFinePointerHover();
		const [hoveredWin, setHoveredWin] = useState<string | null>(null);
		const [showPreviewForWin, setShowPreviewForWin] = useState<string | null>(
			null
		);
		const previewDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
		const [groupMenuOpen, setGroupMenuOpen] = useState<string | null>(null);
		const denseWindowMode = shouldUseDenseTaskbarWindowMode(
			taskbarWindowItems.reduce((sum, item) => sum + item.windows.length, 0) +
				overflowWindows.length
		);

		useImperativeHandle(ref, () => ({
			closeFlyouts: () => {
				setOverflowMenuOpen(false);
				setGroupMenuOpen(null);
				setHoveredWin(null);
				setShowPreviewForWin(null);
				if (previewDelayRef.current) {
					clearTimeout(previewDelayRef.current);
					previewDelayRef.current = null;
				}
			},
			closeHoverFlyouts: () => {
				setHoveredWin(null);
				setShowPreviewForWin(null);
				if (previewDelayRef.current) {
					clearTimeout(previewDelayRef.current);
					previewDelayRef.current = null;
				}
			},
		}));

		useEffect(() => {
			return () => {
				if (previewDelayRef.current) clearTimeout(previewDelayRef.current);
			};
		}, []);

		useEffect(() => {
			if (!overflowMenuOpen) return;
			const close = () => setOverflowMenuOpen(false);
			window.addEventListener('click', close);
			return () => window.removeEventListener('click', close);
		}, [overflowMenuOpen]);

		useEffect(() => {
			if (!groupMenuOpen) return;
			const close = () => setGroupMenuOpen(null);
			window.addEventListener('click', close);
			return () => window.removeEventListener('click', close);
		}, [groupMenuOpen]);

		const getWindowBadgeCount = (desktopWindow: WindowState): number => {
			const sourceApp = resolveWindowSourceApp(apps, desktopWindow);
			if (sourceApp?.type !== 'app') {
				return 0;
			}
			return appBadgeCounts?.[sourceApp.id] ?? 0;
		};

		const isWindowFriendsBadge = (desktopWindow: WindowState): boolean => {
			const sourceApp = resolveWindowSourceApp(apps, desktopWindow);
			return (
				sourceApp?.type === 'app' && isFriendsAppBadge(sourceApp.appComponent)
			);
		};

		const isWindowGafChatBadge = (desktopWindow: WindowState): boolean => {
			const sourceApp = resolveWindowSourceApp(apps, desktopWindow);
			return (
				sourceApp?.type === 'app' && isGafChatAppBadge(sourceApp.appComponent)
			);
		};

		const renderWindowIcon = (
			desktopWindow: WindowState,
			variant: 'taskbar' | 'preview' | 'list' = 'taskbar',
			morphActive = false
		) => {
			const sourceApp = resolveWindowSourceApp(apps, desktopWindow);
			const resolvedAppComponent =
				sourceApp?.type === 'app'
					? (sourceApp.appComponent ?? desktopWindow.appComponent)
					: desktopWindow.appComponent;

			if (resolvedAppComponent) {
				const sizeClass =
					variant === 'preview'
						? 'h-6 w-6 shrink-0'
						: variant === 'list'
							? 'h-5 w-5 shrink-0'
							: taskbar.ICON_SIZE;
				const badge = (
					<DesktopAppBadge
						appComponent={resolvedAppComponent}
						icon={sourceApp?.icon ?? desktopWindow.icon}
						variant={variant}
						className={sizeClass}
						iconStyle={iconStyle}
					/>
				);
				if (variant === 'taskbar') {
					const iconShell = (
						<span className="inline-flex shrink-0 rounded-[0.62rem] ring-1 ring-[rgb(var(--desktop-fg-primary-rgb)/0.14)] ring-inset bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_8%,transparent)]">
							{badge}
						</span>
					);
					if (morphActive) {
						return (
							<DesktopWindowMorphChip
								windowId={desktopWindow.id}
								active
								className="inline-flex shrink-0"
							>
								{iconShell}
							</DesktopWindowMorphChip>
						);
					}
					return iconShell;
				}
				return badge;
			}

			const fallbackClass =
				variant === 'preview'
					? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
					: variant === 'list'
						? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)'
						: `flex ${taskbar.ICON_SIZE} items-center justify-center rounded-[0.58rem] border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)`;

			const fallback = (
				<div className={fallbackClass}>{desktopWindow.icon}</div>
			);
			if (variant === 'taskbar' && morphActive) {
				return (
					<DesktopWindowMorphChip
						windowId={desktopWindow.id}
						active
						className="inline-flex shrink-0"
					>
						{fallback}
					</DesktopWindowMorphChip>
				);
			}
			return fallback;
		};

		return (
			<>
				<div
					className={cn(
						'flex min-w-0 flex-1 gap-1',
						denseWindowMode && 'justify-start overflow-x-auto scrollbar-none'
					)}
					data-taskbar-window-mode={denseWindowMode ? 'dense' : 'normal'}
				>
					{taskbarWindowItems.map((item) => {
						const w = item.windows[0];
						if (!w) return null;
						const taskbarTitle = getTaskbarWindowTitle(w);
						const isGroup = item.windows.length > 1;
						const isGroupOpen = groupMenuOpen === item.key;
						const groupHasActive = item.windows.some(
							(win) => win.id === activeWindowId
						);
						const windowBadge = getWindowBadgeCount(w);
						const friendsWindowBadge = isWindowFriendsBadge(w);
						const gafChatWindowBadge = isWindowGafChatBadge(w);
						const activeWindowChrome =
							'shadow-[inset_0_0_0_1.5px_rgb(var(--desktop-accent-rgb)/0.45)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.55)] ring-inset';
						const groupTitle =
							resolveWindowSourceApp(apps, w)?.name ??
							w.appComponent ??
							taskbarTitle;
						if (isGroup) {
							const groupSurface =
								isGroupOpen || groupHasActive
									? taskbarButtonActiveSurface
									: taskbarButtonSurface;
							return (
								<div
									key={item.key}
									className={cn(
										'relative min-w-0',
										denseWindowMode ? 'w-12 shrink-0' : 'flex-1'
									)}
								>
									<DesktopChromeTooltip
										content={groupTitle}
										placement="top"
										offsetExtra={4}
									>
										<m.button
											data-taskbar-interactive="true"
											type="button"
											onPointerEnter={() => {
												void preloadDesktopApp(w.appComponent);
											}}
											onFocus={() => {
												void preloadDesktopApp(w.appComponent);
											}}
											onClick={() =>
												setGroupMenuOpen((o) =>
													o === item.key ? null : item.key
												)
											}
											onContextMenu={(e) => {
												e.preventDefault();
												e.stopPropagation();
												if (item.windows.length > 0) {
													setWinContextMenu({
														windowId: item.windows[0]?.id,
														x: e.clientX,
														y: e.clientY,
													});
												}
											}}
											className={cn(
												`relative ${taskbar.WINDOW_BUTTON_MIN_H} min-w-0 ${taskbar.BUTTON_PADDING} rounded-md transition-[background-color,border-color,box-shadow,opacity,color] duration-200 motion-reduce:transition-none`,
												denseWindowMode ? 'w-12 shrink-0' : 'flex-1 basis-0',
												DESKTOP_INTERACTIVE.focusRing,
												groupSurface,
												groupHasActive ? activeWindowChrome : ''
											)}
											variants={buttonVariants}
											initial="initial"
											whileHover={finePointerHover ? 'hover' : undefined}
											whileTap="tap"
											aria-current={groupHasActive ? 'true' : undefined}
											aria-label={t('taskbar.groupWindows', {
												name: groupTitle,
												count: item.windows.length,
											})}
											aria-expanded={isGroupOpen}
											aria-haspopup="menu"
										>
											<div
												className={`flex min-w-0 items-center ${taskbar.GAP}`}
											>
												{renderWindowIcon(w, 'taskbar')}
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.taskbarWindowTitle,
														denseWindowMode
															? 'sr-only'
															: 'min-w-0 flex-1 truncate'
													)}
												>
													{groupTitle}
												</span>
												<span
													className={cn(
														DESKTOP_TYPOGRAPHY.taskbarGroupCount,
														'flex items-center justify-center min-h-3.5 min-w-3.5 rounded-full bg-(--desktop-surface-soft-active) px-0.5'
													)}
												>
													{item.windows.length}
												</span>
											</div>
											<TaskbarCountBadge
												count={windowBadge}
												variant={
													friendsWindowBadge
														? 'friends'
														: gafChatWindowBadge
															? 'chat'
															: 'default'
												}
											/>
										</m.button>
									</DesktopChromeTooltip>
									<AnimatePresence>
										{isGroupOpen && (
											<m.div
												data-taskbar-flyout
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 8 }}
												className={`absolute bottom-full mb-2 left-0 w-56 max-h-80 overflow-y-auto ${shellPanel} py-1`}
												style={{ zIndex: portalStackBase }}
											>
												{item.windows.map((win) => {
													const winTitle = getTaskbarWindowTitle(win);
													return (
														<DesktopChromeTooltip
															key={win.id}
															content={winTitle}
															placement="right"
															offsetExtra={4}
														>
															<button
																type="button"
																onPointerEnter={() => {
																	void preloadDesktopApp(win.appComponent);
																}}
																onFocus={() => {
																	void preloadDesktopApp(win.appComponent);
																}}
																onClick={() => {
																	onWinClick(win.id);
																	setGroupMenuOpen(null);
																	setWinContextMenu(null);
																}}
																className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-(--desktop-text-primary) fine-hover:bg-(--desktop-surface-soft-hover)"
															>
																{renderWindowIcon(win, 'list')}
																<span className="truncate flex-1">
																	{winTitle}
																</span>
															</button>
														</DesktopChromeTooltip>
													);
												})}
											</m.div>
										)}
									</AnimatePresence>
								</div>
							);
						}
						const winActive = w.id === activeWindowId;
						const winHover = hoveredWin === w.id;
						const winSurface =
							winActive || winHover
								? taskbarButtonActiveSurface
								: taskbarButtonSurface;
						return (
							<DesktopChromeTooltip
								key={w.id}
								content={taskbarTitle}
								placement="top"
								offsetExtra={4}
							>
								<m.button
									data-taskbar-interactive="true"
									type="button"
									onClick={() => {
										onWinClick(w.id);
										setWinContextMenu(null);
										setGroupMenuOpen(null);
									}}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setWinContextMenu({
											windowId: w.id,
											x: e.clientX,
											y: e.clientY,
										});
									}}
									onPointerEnter={() => {
										void preloadDesktopApp(w.appComponent);
										setHoveredWin(w.id);
										if (previewDelayRef.current)
											clearTimeout(previewDelayRef.current);
										previewDelayRef.current = setTimeout(
											() => setShowPreviewForWin(w.id),
											DESKTOP_TOOLTIP.delayMs
										);
									}}
									onFocus={() => {
										void preloadDesktopApp(w.appComponent);
									}}
									onPointerLeave={() => {
										setHoveredWin(null);
										setShowPreviewForWin(null);
										if (previewDelayRef.current) {
											clearTimeout(previewDelayRef.current);
											previewDelayRef.current = null;
										}
									}}
									className={cn(
										`relative ${taskbar.WINDOW_BUTTON_MIN_H} min-w-0 ${taskbar.BUTTON_PADDING} rounded-md transition-[background-color,border-color,box-shadow,opacity,color] duration-200 motion-reduce:transition-none`,
										denseWindowMode ? 'w-12 shrink-0' : 'flex-1 basis-0',
										DESKTOP_INTERACTIVE.focusRing,
										w.isMinimized ? 'opacity-[0.78]' : '',
										winSurface,
										winActive ? activeWindowChrome : ''
									)}
									variants={buttonVariants}
									initial="initial"
									whileHover={finePointerHover ? 'hover' : undefined}
									whileTap="tap"
									aria-current={winActive ? 'true' : undefined}
									aria-label={
										w.isMinimized
											? t('taskbar.windowListMinimizedAria', {
													title: taskbarTitle,
												})
											: w.id === activeWindowId
												? t('taskbar.windowListActiveAria', {
														title: taskbarTitle,
													})
												: t('taskbar.windowListItemAria', {
														title: taskbarTitle,
													})
									}
								>
									<div className={`flex min-w-0 items-center ${taskbar.GAP}`}>
										{renderWindowIcon(
											w,
											'taskbar',
											w.isMinimized || Boolean(w.isMinimizing)
										)}
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.taskbarWindowTitle,
												denseWindowMode ? 'sr-only' : 'min-w-0 flex-1 truncate'
											)}
										>
											{taskbarTitle}
										</span>
									</div>
									<TaskbarCountBadge
										count={windowBadge}
										variant={
											friendsWindowBadge
												? 'friends'
												: gafChatWindowBadge
													? 'chat'
													: 'default'
										}
									/>

									<m.div
										className="absolute bottom-0.5 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-[rgb(var(--desktop-accent-rgb))]"
										aria-hidden={true}
										initial={{ width: 0 }}
										animate={{
											width: winActive
												? w.isMinimized
													? 8
													: 18
												: w.isMinimized
													? 5
													: 12,
											opacity: winActive ? 1 : 0.55,
										}}
										transition={{
											duration: 0.22,
											ease: [0.16, 1, 0.3, 1],
										}}
									/>

									<TaskbarWindowPreviewFlyout
										window={w}
										taskbarTitle={taskbarTitle}
										shellPanel={shellPanel}
										portalStackBase={portalStackBase}
										reduceMotion={reduceMotion === true}
										visible={showPreviewForWin === w.id && hoveredWin === w.id}
										renderWindowIcon={renderWindowIcon}
									/>
								</m.button>
							</DesktopChromeTooltip>
						);
					})}
				</div>

				{hasOverflow && (
					<div className="relative shrink-0">
						<DesktopChromeTooltip
							content={t('taskbar.moreWindows')}
							placement="top"
						>
							<m.button
								data-taskbar-interactive="true"
								data-taskbar-windows-overflow="true"
								onClick={() => setOverflowMenuOpen((o) => !o)}
								onContextMenu={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setOverflowMenuOpen(true);
								}}
								className={`${taskbar.HIT_MIN_CLASS} p-1 rounded-lg transition-[background-color,border-color,box-shadow,opacity,color] duration-200 motion-reduce:transition-none ${DESKTOP_INTERACTIVE.focusRing} ${overflowMenuOpen ? taskbarButtonActiveSurface : taskbarButtonSurface}`}
								aria-label={t('taskbar.moreWindowsAria')}
								aria-expanded={overflowMenuOpen}
								aria-haspopup="menu"
							>
								<ChevronUpIcon
									className={`${taskbar.ICON_CLASS} rotate-180`}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</m.button>
						</DesktopChromeTooltip>
						<AnimatePresence>
							{overflowMenuOpen && (
								<m.div
									data-taskbar-flyout
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 8 }}
									className={`absolute bottom-full mb-2 left-0 w-56 max-h-80 overflow-y-auto ${shellPanel} py-1`}
									style={{ zIndex: portalStackBase }}
								>
									<div
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'px-3 py-2 border-b border-(--desktop-border-subtle)'
										)}
									>
										{t('taskbar.overflowHeading', {
											count: overflowWindows.length,
										})}
									</div>
									{overflowWindows.map((w) => {
										const overflowTitle = getTaskbarWindowTitle(w);
										return (
											<DesktopChromeTooltip
												key={w.id}
												content={overflowTitle}
												placement="right"
												offsetExtra={4}
											>
												<button
													type="button"
													onPointerEnter={() => {
														void preloadDesktopApp(w.appComponent);
													}}
													onFocus={() => {
														void preloadDesktopApp(w.appComponent);
													}}
													onClick={() => {
														onWinClick(w.id);
														setOverflowMenuOpen(false);
													}}
													className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-(--desktop-text-primary) fine-hover:bg-(--desktop-surface-soft-hover)"
												>
													{renderWindowIcon(w, 'list')}
													<span className="truncate">{overflowTitle}</span>
												</button>
											</DesktopChromeTooltip>
										);
									})}
								</m.div>
							)}
						</AnimatePresence>
					</div>
				)}
			</>
		);
	})
);
TaskbarWindowsOverflowStrip.displayName = 'TaskbarWindowsOverflowStrip';
