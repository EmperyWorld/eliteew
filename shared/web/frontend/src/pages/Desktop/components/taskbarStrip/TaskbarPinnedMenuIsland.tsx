/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pinned apps button, «All pinned» modal, and pinned-app context menu island.
 * Isolated memo subtree so opening the modal does not re-render window buttons.
 *
 * Invariants:
 * - Escape on pinned-app context menu closes ctx first; pinned modal Escape closes grid only when ctx is closed.
 * - Pinned-app modal remains isolated from live window hover flyouts.
 *
 * Related:
 * - `TaskbarPinnedAndWindowsStrip.tsx`
 * - `TaskbarWindowsOverflowStrip.tsx`
 */

import { themeDesignTokens } from '@/theme/designTokens';
import { cn } from '@/utils/cn';
import { AnimatePresence, m, type Variants } from 'framer-motion';
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopIconStyle, DesktopWindowStyle } from '@/types/profile';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import type { OpenWindowOptions } from '../../hooks/useWindowManager';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import { isSystemDesktopApp } from '../../utils/desktopAppRegistry';
import {
	getContextMenuPositionFromCursor,
	getDesktopPortalShellProps,
	isBrowserContextMenuAllowedTarget,
} from '../../utils/desktopUi';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import { useDismissibleFloatingMenu } from '../../hooks/useDismissibleFloatingMenu';
import { useDesktopPopoverOpenGuard } from '../../hooks/useDesktopPopoverOpenGuard';
import { useFinePointerHover } from '../../hooks/useFinePointerHover';
import { shouldDismissPinnedMenuBackdrop } from '../../utils/desktopShellOutsideDismiss';
import {
	DesktopAppButton,
	DesktopAppMenuDivider,
	DesktopAppMenuHeader,
	DesktopAppMenuItem,
	DesktopAppMenuSectionLabel,
	DesktopAppMenuSurface,
	DesktopAppSectionLabel,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { TaskbarCountBadge } from '../TaskbarCountBadge';
import { TaskbarPinnedAppTile } from './TaskbarPinnedAppTile';
import {
	ComputerDesktopIcon,
	PlayIcon,
	RectangleStackIcon,
	SquaresPlusIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export type TaskbarPinnedMenuIslandHandle = {
	closePinnedMenu: () => void;
};

export type TaskbarPinnedMenuIslandProps = {
	taskbarDividerClass: string;
	pinnedMenuButtonSurface: string;
	pinnedMenuButtonActiveSurface: string;
	buttonVariants: Variants;
	shellWindowStyle: DesktopWindowStyle;
	pinnedApps: DesktopItem[];
	pinnedAppsBadgeTotal: number;
	pinnedFriendsBadgeActive: boolean;
	pinnedGafChatBadgeActive: boolean;
	windows: WindowState[];
	iconStyle: DesktopIconStyle;
	appBadgeCounts?: Record<string, number>;
	onWinClick: (id: string) => void;
	onOpenApp: (app: DesktopItem, options?: OpenWindowOptions) => void;
	desktopAppIds: string[];
	onPinAppToDesktop?: (app: DesktopItem) => void;
	onUnpinAppFromDesktop?: (app: DesktopItem) => void;
	preferReducedMotion: boolean;
};

const PINNED_MENU_GRID_DEFER_FRAMES = 2;
const PINNED_MENU_BACKDROP_CLASS =
	'bg-(--desktop-overlay-backdrop) transition-opacity duration-150 motion-reduce:transition-none';
const PINNED_MENU_PANEL_CLASS =
	'relative flex max-h-[min(74vh,calc(100dvh-6rem))] min-h-0 w-[min(590px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border-0 bg-[rgb(var(--desktop-bg-secondary-rgb))] text-(--desktop-text-primary) shadow-[0_30px_80px_rgba(0,0,0,0.58)] will-change-[opacity,transform]';
const PINNED_MENU_HEADER_CLASS =
	'relative shrink-0 border-b border-[color-mix(in_srgb,var(--desktop-text-primary)_10%,transparent)] bg-[rgb(var(--desktop-bg-secondary-rgb))] px-5 pb-3.5 pt-4.5';
const PINNED_MENU_BODY_CLASS =
	'min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[rgb(var(--desktop-bg-primary-rgb))] px-4 pb-4 pt-3 contain-[layout_paint_style]';
const PINNED_MENU_FOOTER_CLASS =
	'border-t border-[color-mix(in_srgb,var(--desktop-text-primary)_10%,transparent)] bg-[rgb(var(--desktop-bg-secondary-rgb))]';

function arePinnedAppsEqual(prev: DesktopItem[], next: DesktopItem[]): boolean {
	if (prev === next) return true;
	if (prev.length !== next.length) return false;
	for (let i = 0; i < prev.length; i += 1) {
		const a = prev[i];
		const b = next[i];
		if (
			a?.id !== b?.id ||
			a?.name !== b?.name ||
			a?.appComponent !== b?.appComponent ||
			a?.icon !== b?.icon
		) {
			return false;
		}
	}
	return true;
}

function arePinnedWindowsEqual(
	prev: WindowState[],
	next: WindowState[]
): boolean {
	if (prev === next) return true;
	if (prev.length !== next.length) return false;
	for (let i = 0; i < prev.length; i += 1) {
		const a = prev[i];
		const b = next[i];
		if (a?.id !== b?.id || a?.folderId !== b?.folderId) {
			return false;
		}
	}
	return true;
}

function arePinnedBadgeCountsEqual(
	prev: Record<string, number> | undefined,
	next: Record<string, number> | undefined,
	pinnedApps: DesktopItem[]
): boolean {
	if (prev === next) return true;
	for (const app of pinnedApps) {
		if ((prev?.[app.id] ?? 0) !== (next?.[app.id] ?? 0)) {
			return false;
		}
	}
	return true;
}

function areStringArraysEqual(prev: string[], next: string[]): boolean {
	if (prev === next) return true;
	if (prev.length !== next.length) return false;
	for (let i = 0; i < prev.length; i += 1) {
		if (prev[i] !== next[i]) return false;
	}
	return true;
}

function areTaskbarPinnedMenuIslandPropsEqual(
	prev: TaskbarPinnedMenuIslandProps,
	next: TaskbarPinnedMenuIslandProps
): boolean {
	return (
		prev.taskbarDividerClass === next.taskbarDividerClass &&
		prev.pinnedMenuButtonSurface === next.pinnedMenuButtonSurface &&
		prev.pinnedMenuButtonActiveSurface === next.pinnedMenuButtonActiveSurface &&
		prev.buttonVariants === next.buttonVariants &&
		prev.shellWindowStyle === next.shellWindowStyle &&
		prev.pinnedAppsBadgeTotal === next.pinnedAppsBadgeTotal &&
		prev.pinnedFriendsBadgeActive === next.pinnedFriendsBadgeActive &&
		prev.pinnedGafChatBadgeActive === next.pinnedGafChatBadgeActive &&
		prev.iconStyle === next.iconStyle &&
		prev.onWinClick === next.onWinClick &&
		prev.onOpenApp === next.onOpenApp &&
		prev.onPinAppToDesktop === next.onPinAppToDesktop &&
		prev.onUnpinAppFromDesktop === next.onUnpinAppFromDesktop &&
		prev.preferReducedMotion === next.preferReducedMotion &&
		areStringArraysEqual(prev.desktopAppIds, next.desktopAppIds) &&
		arePinnedAppsEqual(prev.pinnedApps, next.pinnedApps) &&
		arePinnedWindowsEqual(prev.windows, next.windows) &&
		arePinnedBadgeCountsEqual(
			prev.appBadgeCounts,
			next.appBadgeCounts,
			next.pinnedApps
		)
	);
}

const TaskbarPinnedMenuIslandInner = forwardRef<
	TaskbarPinnedMenuIslandHandle,
	TaskbarPinnedMenuIslandProps
>(function TaskbarPinnedMenuIslandInner(
	{
		taskbarDividerClass,
		pinnedMenuButtonSurface,
		pinnedMenuButtonActiveSurface,
		buttonVariants,
		pinnedApps,
		pinnedAppsBadgeTotal,
		pinnedFriendsBadgeActive,
		pinnedGafChatBadgeActive,
		windows,
		iconStyle,
		appBadgeCounts,
		onWinClick,
		onOpenApp,
		desktopAppIds,
		onPinAppToDesktop,
		onUnpinAppFromDesktop,
		preferReducedMotion,
	},
	ref
) {
	const { t } = useTranslation('desktopUi');
	const { taskbar } = themeDesignTokens.desktop;
	const finePointerHover = useFinePointerHover();
	const [showPinnedMenu, setShowPinnedMenu] = useState(false);
	const [isPinnedMenuPortalMounted, setPinnedMenuPortalMounted] =
		useState(false);
	const [renderPinnedGrid, setRenderPinnedGrid] = useState(false);
	const [pinnedAppCtx, setPinnedAppCtx] = useState<{
		x: number;
		y: number;
		app: DesktopItem;
	} | null>(null);
	const pinnedAppMenuRef = useRef<HTMLDivElement>(null);
	const pinnedMenuOpenGuardRef = useDesktopPopoverOpenGuard(showPinnedMenu);

	const windowByFolderId = useMemo(() => {
		const map = new Map<string, WindowState>();
		for (const win of windows) {
			const fid = win.folderId;
			if (fid == null || fid === '') continue;
			if (!map.has(fid)) map.set(fid, win);
		}
		return map;
	}, [windows]);
	const desktopAppIdSet = useMemo(
		() => new Set(desktopAppIds),
		[desktopAppIds]
	);
	const portalShellProps =
		isPinnedMenuPortalMounted || pinnedAppCtx != null
			? getDesktopPortalShellProps()
			: null;

	const openPinnedMenu = useCallback(() => {
		setPinnedMenuPortalMounted(true);
		setShowPinnedMenu(true);
	}, []);

	const closePinnedMenu = useCallback(() => {
		setPinnedAppCtx(null);
		setShowPinnedMenu(false);
	}, []);

	const handlePinnedMenuBackdropClose = useCallback(() => {
		if (!shouldDismissPinnedMenuBackdrop(pinnedMenuOpenGuardRef.current)) {
			return;
		}
		closePinnedMenu();
	}, [closePinnedMenu, pinnedMenuOpenGuardRef]);

	const closePinnedAppContextMenu = useCallback(() => {
		setPinnedAppCtx(null);
	}, []);

	const handlePinnedAppContextMenu = useCallback(
		(e: ReactMouseEvent, app: DesktopItem) => {
			e.preventDefault();
			e.stopPropagation();
			setPinnedAppCtx({ x: e.clientX, y: e.clientY, app });
		},
		[]
	);

	useDismissibleFloatingMenu({
		isOpen: pinnedAppCtx != null,
		menuRef: pinnedAppMenuRef,
		onClose: closePinnedAppContextMenu,
		escapeCapture: true,
		focusFirstMenuItem: true,
	});

	useImperativeHandle(
		ref,
		() => ({
			closePinnedMenu,
		}),
		[closePinnedMenu]
	);

	useEffect(() => {
		if (!showPinnedMenu) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			if (pinnedAppCtx != null) {
				setPinnedAppCtx(null);
				return;
			}
			closePinnedMenu();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [closePinnedMenu, pinnedAppCtx, showPinnedMenu]);

	useEffect(() => {
		if (!showPinnedMenu) {
			setRenderPinnedGrid(false);
			return;
		}
		if (preferReducedMotion) {
			setRenderPinnedGrid(true);
			return;
		}

		let frame = 0;
		let rafId = 0;
		const schedule = () => {
			frame += 1;
			if (frame >= PINNED_MENU_GRID_DEFER_FRAMES) {
				setRenderPinnedGrid(true);
				return;
			}
			rafId = window.requestAnimationFrame(schedule);
		};
		rafId = window.requestAnimationFrame(schedule);
		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, [preferReducedMotion, showPinnedMenu]);

	const backdropTransition = preferReducedMotion
		? { duration: 0.05 }
		: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };
	const panelTransition = preferReducedMotion
		? { duration: 0.05 }
		: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };
	const pinnedAppCtxPosition =
		pinnedAppCtx != null
			? getContextMenuPositionFromCursor({
					clientX: pinnedAppCtx.x,
					clientY: pinnedAppCtx.y,
					menuWidth: 280,
					menuHeight: 260,
				})
			: null;

	if (pinnedApps.length === 0) {
		return null;
	}

	const modal =
		isPinnedMenuPortalMounted && typeof document !== 'undefined' ? (
			<ShellPortalMount>
				<AnimatePresence
					onExitComplete={() => {
						setPinnedMenuPortalMounted(false);
					}}
				>
					{showPinnedMenu && (
						<m.div
							data-theme={portalShellProps?.theme}
							className={cn(
								'fixed inset-0 flex items-center justify-center p-4 sm:p-6',
								PINNED_MENU_BACKDROP_CLASS
							)}
							style={{
								...(portalShellProps?.style ?? {}),
								zIndex: DESKTOP_Z_INDEX.MODAL,
							}}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={backdropTransition}
							layout={false}
							onClick={handlePinnedMenuBackdropClose}
						>
							<m.div
								data-taskbar-pinned-menu
								className={PINNED_MENU_PANEL_CLASS}
								style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}
								initial={
									preferReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
								}
								animate={{ opacity: 1, y: 0 }}
								exit={
									preferReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
								}
								transition={panelTransition}
								onClick={(e) => e.stopPropagation()}
								layout={false}
								role="dialog"
								aria-modal="true"
								aria-labelledby="taskbar-pinned-menu-title"
							>
								<div className={PINNED_MENU_HEADER_CLASS}>
									<div className="flex items-start justify-between gap-3 pr-10">
										<div className="min-w-0">
											<DesktopAppSectionLabel
												id="taskbar-pinned-menu-title"
												className="tracking-[0.2em]"
											>
												{t('taskbar.pinnedMenuTitle')}
											</DesktopAppSectionLabel>
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'mt-1 leading-relaxed text-(--desktop-text-muted)'
												)}
											>
												{t('taskbar.pinnedMenuSubtitle', {
													count: pinnedApps.length,
												})}
											</p>
										</div>
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.sectionPill,
												'shrink-0 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1 tabular-nums'
											)}
											aria-hidden
										>
											{pinnedApps.length}
										</span>
									</div>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="icon"
										className="absolute right-3 top-3"
										onClick={closePinnedMenu}
										aria-label={t('taskbar.pinnedCloseAria')}
									>
										<XMarkIcon
											className={DESKTOP_LUCIDE.md}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</DesktopAppButton>
								</div>

								<div
									className={PINNED_MENU_BODY_CLASS}
									aria-busy={!renderPinnedGrid}
								>
									{renderPinnedGrid ? (
										<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
											{pinnedApps.map((app) => {
												const win = windowByFolderId.get(app.id);
												return (
													<TaskbarPinnedAppTile
														key={app.id}
														app={app}
														badge={appBadgeCounts?.[app.id] ?? 0}
														iconStyle={iconStyle}
														isOpen={!!win}
														openWindowId={win?.id}
														openBadgeLabel={t('taskbar.pinnedOpenBadge')}
														onWinClick={onWinClick}
														onOpenApp={onOpenApp}
														onClose={closePinnedMenu}
														onContextMenu={handlePinnedAppContextMenu}
													/>
												);
											})}
										</div>
									) : (
										<div className="min-h-[260px]" aria-hidden />
									)}
								</div>

								<div className={PINNED_MENU_FOOTER_CLASS}>
									<div className="flex items-center justify-between gap-3 px-4 py-2.5">
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.shellMeta10,
												'text-(--desktop-text-muted)'
											)}
										>
											{t('taskbar.pinnedMenuEscHint')} ·{' '}
											{t('taskbar.pinnedMenuContextHint')}
										</span>
										<kbd className={DESKTOP_TYPOGRAPHY.shellKbdGlyph}>Esc</kbd>
									</div>
								</div>
							</m.div>
						</m.div>
					)}
				</AnimatePresence>
			</ShellPortalMount>
		) : null;
	const pinnedAppContextMenu =
		pinnedAppCtx && pinnedAppCtxPosition && typeof document !== 'undefined' ? (
			<ShellPortalMount>
				<m.div
					ref={pinnedAppMenuRef}
					data-theme={portalShellProps?.theme}
					role="menu"
					aria-label={t('taskbar.pinnedContextLabel', {
						name: pinnedAppCtx.app.name,
					})}
					initial={{ opacity: 0, scale: 0.98, y: 4 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
					className="fixed text-(--desktop-text-primary)"
					style={{
						...(portalShellProps?.style ?? {}),
						left: pinnedAppCtxPosition.x,
						top: pinnedAppCtxPosition.y,
						zIndex: DESKTOP_Z_INDEX.CONTEXT_MENU,
					}}
					onContextMenu={(e) => {
						if (isBrowserContextMenuAllowedTarget(e.target)) return;
						e.preventDefault();
						e.stopPropagation();
					}}
				>
					<DesktopAppMenuSurface className="min-w-[260px] max-w-[min(92vw,310px)] overflow-hidden border-0 bg-[rgb(var(--desktop-bg-secondary-rgb))] shadow-[0_24px_64px_rgba(0,0,0,0.5)] ring-0 backdrop-blur-none">
						<DesktopAppMenuHeader
							className="bg-[rgb(var(--desktop-bg-secondary-rgb))]"
							leading={
								<DesktopAppBadge
									appComponent={pinnedAppCtx.app.appComponent}
									icon={pinnedAppCtx.app.icon}
									variant="start"
									className="relative h-9 w-9"
									iconStyle={iconStyle}
								/>
							}
							title={pinnedAppCtx.app.name}
							subtitle={
								windowByFolderId.get(pinnedAppCtx.app.id)
									? t('taskbar.pinnedContextOpenSubtitle')
									: t('taskbar.pinnedContextReadySubtitle')
							}
						/>
						<div className="px-1 py-1.5">
							{(() => {
								const app = pinnedAppCtx.app;
								const win = windowByFolderId.get(app.id);
								const onDesk = desktopAppIdSet.has(app.id);
								const canChangeDesktopShortcut =
									!isSystemDesktopApp(app) &&
									(onPinAppToDesktop != null || onUnpinAppFromDesktop != null);
								return (
									<>
										<DesktopAppMenuItem
											type="button"
											role="menuitem"
											className={DESKTOP_INTERACTIVE.focusRing}
											icon={
												<PlayIcon
													className={DESKTOP_LUCIDE.md}
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
											}
											onClick={() => {
												if (win) {
													onWinClick(win.id);
												} else {
													onOpenApp(app);
												}
												closePinnedMenu();
											}}
										>
											{win
												? t('taskbar.pinnedContextFocusWindow')
												: t('startMenu.openApp')}
										</DesktopAppMenuItem>
										<DesktopAppMenuItem
											type="button"
											role="menuitem"
											className={DESKTOP_INTERACTIVE.focusRing}
											icon={
												<SquaresPlusIcon
													className={DESKTOP_LUCIDE.md}
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
											}
											onClick={() => {
												onOpenApp(app, { forceNew: true });
												closePinnedMenu();
											}}
										>
											{t('startMenu.newWindow')}
										</DesktopAppMenuItem>
										{canChangeDesktopShortcut ? (
											<>
												<DesktopAppMenuDivider className="mx-1.5" />
												<DesktopAppMenuSectionLabel className="border-0 bg-transparent px-3 pb-1 pt-1">
													{t('taskbar.pinnedContextDesktopSection')}
												</DesktopAppMenuSectionLabel>
												{onDesk && onUnpinAppFromDesktop ? (
													<DesktopAppMenuItem
														type="button"
														role="menuitem"
														className={DESKTOP_INTERACTIVE.focusRing}
														icon={
															<ComputerDesktopIcon
																className={DESKTOP_LUCIDE.md}
																strokeWidth={DESKTOP_LUCIDE.stroke}
															/>
														}
														onClick={() => {
															onUnpinAppFromDesktop(app);
															closePinnedAppContextMenu();
														}}
													>
														{t('startMenu.unpinFromDesktop')}
													</DesktopAppMenuItem>
												) : onPinAppToDesktop ? (
													<DesktopAppMenuItem
														type="button"
														role="menuitem"
														className={DESKTOP_INTERACTIVE.focusRing}
														disabled={onDesk}
														icon={
															<ComputerDesktopIcon
																className={DESKTOP_LUCIDE.md}
																strokeWidth={DESKTOP_LUCIDE.stroke}
															/>
														}
														onClick={() => {
															if (onDesk) {
																closePinnedAppContextMenu();
																return;
															}
															onPinAppToDesktop(app);
															closePinnedAppContextMenu();
														}}
													>
														{onDesk
															? t('startMenu.alreadyOnDesktop')
															: t('startMenu.pinToDesktop')}
													</DesktopAppMenuItem>
												) : null}
											</>
										) : null}
									</>
								);
							})()}
						</div>
					</DesktopAppMenuSurface>
				</m.div>
			</ShellPortalMount>
		) : null;

	return (
		<>
			<div className="flex items-center gap-1 shrink-0">
				<div
					className={cn(
						'rounded-xl p-px transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none',
						showPinnedMenu
							? 'border border-[rgb(var(--desktop-accent-rgb)/0.42)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] shadow-[inset_0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.22)]'
							: 'border border-transparent fine-hover:border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_16%,transparent)] fine-hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb))_8%,transparent)]'
					)}
				>
					<DesktopChromeTooltip
						content={t('taskbar.pinnedTitle')}
						placement="top"
					>
						<m.button
							data-taskbar-interactive="true"
							type="button"
							onClick={openPinnedMenu}
							onContextMenu={(e) => {
								e.preventDefault();
								e.stopPropagation();
								openPinnedMenu();
							}}
							className={`${taskbar.HIT_MIN_CLASS} rounded-[0.65rem] px-1.5 py-1 transition-[background-color,opacity,color] duration-200 motion-reduce:transition-none ${DESKTOP_INTERACTIVE.focusRing} ${showPinnedMenu ? pinnedMenuButtonActiveSurface : pinnedMenuButtonSurface}`}
							variants={buttonVariants}
							initial="initial"
							whileHover={finePointerHover ? 'hover' : undefined}
							whileTap="tap"
							aria-label={t('taskbar.pinnedAria')}
							aria-expanded={showPinnedMenu}
							aria-haspopup="dialog"
						>
							<span className="relative flex items-center justify-center">
								<RectangleStackIcon
									className={cn(
										taskbar.ICON_CLASS,
										showPinnedMenu &&
											'text-[rgb(var(--desktop-accent-rgb)/0.98)]'
									)}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								<TaskbarCountBadge
									count={pinnedAppsBadgeTotal}
									variant={
										pinnedFriendsBadgeActive
											? 'friends'
											: pinnedGafChatBadgeActive
												? 'chat'
												: 'default'
									}
									positionClassName="-top-2 -right-2"
								/>
							</span>
						</m.button>
					</DesktopChromeTooltip>
				</div>
				<div className={`w-px h-7 mx-0.5 shrink-0 ${taskbarDividerClass}`} />
			</div>
			{modal}
			{pinnedAppContextMenu}
		</>
	);
});

export const TaskbarPinnedMenuIsland = memo(
	TaskbarPinnedMenuIslandInner,
	areTaskbarPinnedMenuIslandPropsEqual
);
TaskbarPinnedMenuIsland.displayName = 'TaskbarPinnedMenuIsland';
