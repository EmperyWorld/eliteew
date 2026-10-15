/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Windows-style desktop taskbar with Start menu, pinned/windows strip, tray,
 * notification center, session/device entrypoint, clock and shell menus.
 *
 * Invariants:
 * - Right toolbar receives explicit callbacks; background process state stays in child providers.
 * - Taskbar context menus and floating panels use desktop portal/z-index contracts.
 * - Escape on taskbar context menus closes the top menu first; shell popovers close only when no ctx menu is open.
 * - Start Menu open defers taskbar popover Escape (Start Menu owns layered Escape).
 * - Clock seconds flyout defers taskbar popover Escape while open.
 * - Background-processes tray panel defers taskbar popover Escape while open.
 * - Command palette, quick search, task switcher, shortcuts help, wallpaper, new folder, clipboard and app store defer via `shellOverlayConsumesEscape`.
 *
 * Related:
 * - components/TaskbarRightToolbar.tsx
 * - components/TaskbarShellContextMenus.tsx
 * - hooks/useTaskbarPopoverController.ts
 * - components/taskbarStrip/taskbarDerivedData.ts
 * - hooks/useDesktopWorkspaceShellTaskbarProps.ts
 */

import { themeDesignTokens } from '@/theme/designTokens';
import { DESKTOP_Z_INDEX, TASKBAR } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { AnimatePresence, m } from 'framer-motion';
import {
	Suspense,
	lazy,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type FC,
	type MouseEvent,
	type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import {
	DESKTOP_PANEL_OPACITY_MAX,
	DESKTOP_PANEL_OPACITY_MIN,
	normalizeDesktopTaskbarStyle,
	type DesktopIconStyle,
	type DesktopTaskbarStyle,
	type DesktopWindowStyle,
} from '../../../types/profile';
import { useDesktopShellMotionPrefs } from '../context/DesktopShellMotionPrefsContext';
import { useTaskbarShellMetaPrefs } from '../context/DesktopTaskbarShellPrefsContext';
import { useDesktopInViewportReachability } from '../hooks/useDesktopInViewportReachability';
import { useDesktopWelcomeNudge } from '../hooks/useDesktopWelcomeNudge';
import { useDismissibleFloatingMenu } from '../hooks/useDismissibleFloatingMenu';
import { useFinePointerHover } from '../hooks/useFinePointerHover';
import { useTaskbarPopoverController } from '../hooks/useTaskbarPopoverController';
import type { OpenWindowOptions } from '../hooks/useWindowManager';
import type { VirtualDesktop } from '../hooks/useVirtualDesktops';
import type {
	DesktopItem,
	RecentFile,
	WindowState,
} from '../types/desktop.types';
import type {
	DesktopExpansionDiscoveryState,
	DesktopExpansionLaunchActions,
} from '../types/desktopExpansion.types';
import type { StoreAppResponse } from '../services/desktopApi';
import { desktopShellTaskbarEnterVariants } from '../utils/desktopShellMotion';
import { DESKTOP_LASER_POINTER_DISMISS_EVENT } from '../utils/desktopLaserPointerEnvironment';
import { dismissTaskbarLaserPointerHoverChrome } from '../utils/desktopTaskbarWindowFlyoutDismiss';
import {
	getContextMenuTargetElement,
	getFloatingMenuPosition,
	isBrowserContextMenuAllowedTarget,
} from '../utils/desktopUi';
import { applyDesktopContextMenuPolicy } from '../utils/desktopContextMenuPolicy';
import {
	DESKTOP_TASKBAR_STYLE_PRESETS,
	getDesktopShellPanelClassName,
	TASKBAR_PANEL_OPACITY_OVERLAY_WEIGHT,
} from '../utils/desktopVisualSystem';
import { resolveDesktopWindowDisplayTitle } from '../utils/desktopWindowDisplayTitle';
import { DesktopWelcomeNudgeBanner } from './DesktopWelcomeNudgeBanner';
import { type TaskbarClockHandle } from './TaskbarClock';
import { TaskbarLeftCluster } from './TaskbarLeftCluster';
import {
	TaskbarPinnedAndWindowsStrip,
	type TaskbarPinnedAndWindowsStripHandle,
} from './TaskbarPinnedAndWindowsStrip';
import { TaskbarRightToolbar } from './TaskbarRightToolbar';
import {
	TaskbarShellContextMenus,
	type TaskbarPointContextMenuState,
	type TaskbarWinContextMenuState,
} from './TaskbarShellContextMenus';
import { useTaskbarDerivedStripData } from './taskbarStrip/taskbarDerivedData';
import { StartMenuSuspenseFallback } from './startMenu/StartMenuSuspenseFallback';

const StartMenu = lazy(() =>
	import('./StartMenu').then((m) => ({ default: m.StartMenu }))
);

interface TaskbarProps {
	windows: WindowState[];
	apps: DesktopItem[];
	desktopItems?: DesktopItem[];
	onWinClick: (id: string) => void;
	onFocusWindow?: (id: string) => void;
	onMinimizeWindow?: (id: string) => void;
	onToggleMaximizeWindow?: (id: string) => void;
	onCloseWindow?: (id: string) => void;
	onOpenApp: (app: DesktopItem, options?: OpenWindowOptions) => void;
	onWallpaper: () => void;
	onShowShortcuts?: () => void;
	/** Open clipboard history overlay (Win+V). */
	onOpenClipboard?: () => void;
	/** Manual launch of desktop shell spotlight tour (GT-13). */
	onOpenDesktopWelcomeTour?: () => void;
	onOpenSessionInfo?: () => void;
	onOpenProfile?: () => void;
	onAppStore?: () => void;
	/** Open unified admin page for users with UGS admin access */
	onOpenAdmin?: () => void;
	/** Пуск: ПКМ по приложению — вынести ярлык на рабочий стол */
	onPinAppToDesktop?: (app: DesktopItem) => void;
	onUnpinAppFromDesktop?: (app: DesktopItem) => void;
	onOpenAppInWorkspace?: (app: DesktopItem, workspaceProfileId: string) => void;
	recentFiles?: RecentFile[];
	/** Server feed: library recently opened (last_accessed / updated). */
	recentLibraryOpened?: RecentFile[];
	/** Server feed: library recently added (created_at). */
	recentLibraryAdded?: RecentFile[];
	/** Studio / UGS / service-tagged content (source_service), newest first. */
	recentLibraryGenerated?: RecentFile[];
	/** User uploads and imports (no source_service), newest first. */
	recentLibraryUploaded?: RecentFile[];
	/** Server feed: recent library projects (discovery). */
	recentLibraryProjects?: RecentFile[];
	/** Recent content feed: loading initial GET. */
	recentContentFeedLoading?: boolean;
	/** Recent content feed: last error message (non-blocking; UI may keep stale rows). */
	recentContentFeedError?: string | null;
	/** Recent content feed: last successful load timestamp (ms). */
	recentContentFeedLoadedAt?: number | null;
	/** True if any slice of the feed has rows (opened/added/generated/uploaded/projects). */
	hasRecentContentFeedItems?: boolean;
	/** Refresh library feed from `/desktop/recent-content-feed`. */
	onRefetchRecentContentFeed?: () => void | Promise<void>;
	/** Open Settings → Shell → workspaces (scenarios / virtual desktops). */
	onOpenShellWorkspacesSettings?: () => void;
	onStartMenuOpenRecentFile?: (file: RecentFile) => void;
	onStartMenuRemoveRecentFile?: (fileId: string) => void;
	startMenuActiveDesktopId?: string;
	storeApps?: StoreAppResponse[];
	/** Virtual desktops: enable "Move to desktop" context menu on window buttons */
	desktops?: VirtualDesktop[];
	moveWindowToDesktop?: (windowId: string, desktopId: string) => void;
	/** Active (focused) window id for taskbar highlight; derived from max zIndex. */
	activeWindowId?: string | null;
	/** Compact mode for small screens (e.g. mobile): smaller height, reduced chrome. */
	compact?: boolean;
	/** Server-backed visual surface preset for the taskbar. */
	visualStyle?: DesktopTaskbarStyle;
	/** Непрозрачность фона полосы (0.35…1): усиливает «твёрдый» слой поверх стекла, без затемнения кнопок. */
	panelOpacity?: number;
	/** Плавающие панели (Пуск, трей, превью) — в одной системе с окнами. */
	shellWindowStyle?: DesktopWindowStyle;
	/** Icon rendering mode shared with desktop icon style setting. */
	iconStyle?: DesktopIconStyle;
	/** Optional badge counts per app id (e.g. unread messages). */
	appBadgeCounts?: Record<string, number>;
	/** Персистентные приложения, свёрнутые в фон (кнопка «—» / «Показать рабочий стол»). */
	minimizedPersistentSurfaceApps?: ReadonlySet<string>;
	expansionState?: DesktopExpansionDiscoveryState;
	expansionLaunchActions?: DesktopExpansionLaunchActions;
	/** Open (non-minimized) windows on the active desktop — Start Menu “Continue”. */
	startMenuResumeWindows?: { id: string; title: string }[];
	/** Focus / restore window from Start Menu (always brings forward; unlike taskbar toggle). */
	onStartMenuResumeOpenWindow?: (windowId: string) => void;
	/**
	 * When this number increases (e.g. from command palette), open the notification center.
	 * Initial 0 does not open on mount.
	 */
	notificationCenterOpenNonce?: number;
	/** Global desktop wallpaper (config) for workspace card preview in Start Menu. */
	startMenuGlobalWallpaper?: string;
	/** Full window list for Start Menu workspace scenario cards (live desktop state). */
	startMenuWorkspaceContextWindows?: WindowState[];
	getWindowsOnDesktop?: (desktopId: string) => string[] | undefined;
	/**
	 * When true, taskbar shell popover Escape is deferred (command palette, quick search, etc.).
	 */
	shellOverlayConsumesEscape?: boolean;
	/** GAF tray + notification details wait for deferred Desktop runtime. */
	mountDeferredTray?: boolean;
	children?: ReactNode;
}

export const Taskbar: FC<TaskbarProps> = memo(
	({
		windows,
		apps,
		desktopItems = [],
		onWinClick,
		onFocusWindow,
		onMinimizeWindow,
		onToggleMaximizeWindow,
		onCloseWindow,
		onOpenApp,
		onWallpaper,
		onShowShortcuts,
		onOpenClipboard,
		onOpenDesktopWelcomeTour,
		onOpenSessionInfo,
		onOpenProfile,
		onAppStore,
		onOpenAdmin,
		onPinAppToDesktop,
		onUnpinAppFromDesktop,
		onOpenAppInWorkspace,
		recentFiles = [],
		recentLibraryOpened = [],
		recentLibraryAdded = [],
		recentLibraryGenerated = [],
		recentLibraryUploaded = [],
		recentLibraryProjects = [],
		recentContentFeedLoading = false,
		recentContentFeedError = null,
		recentContentFeedLoadedAt = null,
		hasRecentContentFeedItems = false,
		onRefetchRecentContentFeed,
		onOpenShellWorkspacesSettings,
		onStartMenuOpenRecentFile,
		onStartMenuRemoveRecentFile,
		startMenuActiveDesktopId,
		storeApps,
		desktops = [],
		moveWindowToDesktop,
		activeWindowId = null,
		compact = false,
		visualStyle = 'glass',
		panelOpacity: panelOpacityProp = 1,
		shellWindowStyle = 'glass',
		iconStyle = 'glass',
		appBadgeCounts,
		minimizedPersistentSurfaceApps,
		expansionState,
		expansionLaunchActions,
		startMenuResumeWindows = [],
		onStartMenuResumeOpenWindow,
		notificationCenterOpenNonce = 0,
		startMenuGlobalWallpaper = '',
		startMenuWorkspaceContextWindows = [],
		getWindowsOnDesktop,
		shellOverlayConsumesEscape = false,
		mountDeferredTray = false,
		children,
	}) => {
		const { t } = useTranslation('desktopUi');
		const portalStackBase = useDesktopWindowPortalStackBase();
		const { reduceMotion, speed } = useDesktopShellMotionPrefs();
		const finePointerHover = useFinePointerHover();
		const taskbarVariants = useMemo(
			() => desktopShellTaskbarEnterVariants(reduceMotion, speed),
			[reduceMotion, speed]
		);
		const buttonVariants = useMemo(
			() => ({
				initial: { scale: 1 },
				hover:
					finePointerHover && !reduceMotion
						? { scale: 1.02, y: 0 }
						: { scale: 1, y: 0 },
				tap: reduceMotion ? { scale: 1 } : { scale: 0.98 },
				active: reduceMotion ? { scale: 1 } : { scale: 1.01 },
			}),
			[finePointerHover, reduceMotion]
		);
		const { taskbar } = themeDesignTokens.desktop;
		const { logout, user: currentUser } = useAuth();
		const heightClass = compact
			? taskbar.HEIGHT_CLASS_COMPACT
			: taskbar.HEIGHT_CLASS;
		const taskbarStyleKey = normalizeDesktopTaskbarStyle(visualStyle);
		const taskbarStylePreset =
			DESKTOP_TASKBAR_STYLE_PRESETS[taskbarStyleKey] ??
			DESKTOP_TASKBAR_STYLE_PRESETS.glass;
		const panelOpacity =
			typeof panelOpacityProp === 'number' && Number.isFinite(panelOpacityProp)
				? Math.min(
						DESKTOP_PANEL_OPACITY_MAX,
						Math.max(DESKTOP_PANEL_OPACITY_MIN, panelOpacityProp)
					)
				: DESKTOP_PANEL_OPACITY_MAX;
		const taskbarSolidOverlayOpacity = useMemo(() => {
			const span = DESKTOP_PANEL_OPACITY_MAX - DESKTOP_PANEL_OPACITY_MIN;
			const progress =
				span > 0 ? (panelOpacity - DESKTOP_PANEL_OPACITY_MIN) / span : 1;
			const weight =
				TASKBAR_PANEL_OPACITY_OVERLAY_WEIGHT[taskbarStyleKey] ?? 0.5;
			return Math.min(1, Math.max(0, progress * weight));
		}, [panelOpacity, taskbarStyleKey]);
		const {
			dividerClass: taskbarDividerClass,
			buttonSurface: taskbarButtonSurface,
			buttonActiveSurface: taskbarButtonActiveSurface,
			surfaceClassName: taskbarSurfaceClassName,
			surfaceStyle: taskbarSurfaceStyle,
		} = taskbarStylePreset;
		const taskbarStripRef = useRef<HTMLDivElement>(null);
		const taskbarSurfaceBackdropRef = useRef<HTMLDivElement>(null);
		useLayoutEffect(() => {
			const strip = taskbarStripRef.current;
			if (strip) {
				strip.style.setProperty(
					'padding-bottom',
					'env(safe-area-inset-bottom, 0px)'
				);
				strip.style.setProperty('z-index', String(DESKTOP_Z_INDEX.PANEL));
			}
			const surface = taskbarSurfaceBackdropRef.current;
			if (surface) {
				Object.assign(surface.style, taskbarSurfaceStyle);
			}
		}, [taskbarSurfaceStyle]);
		const shellPanel = useMemo(
			() => getDesktopShellPanelClassName(shellWindowStyle, 'standard'),
			[shellWindowStyle]
		);
		const shellPanelStrong = useMemo(
			() => getDesktopShellPanelClassName(shellWindowStyle, 'strong'),
			[shellWindowStyle]
		);
		const taskbarRightIconSurface =
			taskbarStyleKey === 'premium'
				? 'border-0 bg-transparent shadow-none [box-shadow:none] fine-hover:bg-[rgba(212,175,106,0.14)]'
				: TASKBAR.RIGHT_ICON_SURFACE;
		const taskbarRightIconActiveSurface =
			taskbarStyleKey === 'premium'
				? 'border-0 shadow-none [box-shadow:none] bg-[rgba(212,175,106,0.22)] fine-hover:bg-[rgba(212,175,106,0.3)]'
				: TASKBAR.RIGHT_ICON_ACTIVE_SURFACE;

		const [winContextMenu, setWinContextMenu] =
			useState<TaskbarWinContextMenuState>(null);
		const [startContextMenu, setStartContextMenu] =
			useState<TaskbarPointContextMenuState>(null);
		const [taskbarContextMenu, setTaskbarContextMenu] =
			useState<TaskbarPointContextMenuState>(null);
		const [isLoggingOut, setIsLoggingOut] = useState(false);
		const clockRef = useRef<TaskbarClockHandle | null>(null);
		const pinnedWindowsStripRef =
			useRef<TaskbarPinnedAndWindowsStripHandle | null>(null);
		const winContextMenuRef = useRef<HTMLDivElement>(null);
		const startContextMenuRef = useRef<HTMLDivElement>(null);
		const taskbarContextMenuRef = useRef<HTMLDivElement>(null);

		const {
			showStart,
			setShowStart,
			startMenuIntent,
			showNotifications,
			setShowNotifications,
			showTray,
			setShowTray,
			handleToggleTray,
			handleCloseTray,
			handleNotificationBellClick,
			handleCloseNotificationPanel,
			handleStartButtonClick,
		} = useTaskbarPopoverController({
			notificationCenterOpenNonce,
			shellOverlayConsumesEscape,
			clockRef,
			pinnedWindowsStripRef,
			contextMenus: {
				winContextMenu,
				startContextMenu,
				taskbarContextMenu,
			},
		});

		const closeWinContextMenu = useCallback(() => setWinContextMenu(null), []);
		const closeStartContextMenu = useCallback(
			() => setStartContextMenu(null),
			[]
		);
		const closeTaskbarContextMenu = useCallback(
			() => setTaskbarContextMenu(null),
			[]
		);

		useDismissibleFloatingMenu({
			isOpen: winContextMenu != null,
			menuRef: winContextMenuRef,
			onClose: closeWinContextMenu,
			escapeCapture: true,
			focusFirstMenuItem: true,
		});
		useDismissibleFloatingMenu({
			isOpen: startContextMenu != null,
			menuRef: startContextMenuRef,
			onClose: closeStartContextMenu,
			escapeCapture: true,
			focusFirstMenuItem: true,
		});
		useDismissibleFloatingMenu({
			isOpen: taskbarContextMenu != null,
			menuRef: taskbarContextMenuRef,
			onClose: closeTaskbarContextMenu,
			escapeCapture: true,
			focusFirstMenuItem: true,
		});

		const dismissLaserPointerHoverChrome = useCallback(() => {
			dismissTaskbarLaserPointerHoverChrome(pinnedWindowsStripRef.current);
		}, []);

		useEffect(() => {
			window.addEventListener(
				DESKTOP_LASER_POINTER_DISMISS_EVENT,
				dismissLaserPointerHoverChrome
			);
			return () =>
				window.removeEventListener(
					DESKTOP_LASER_POINTER_DISMISS_EVENT,
					dismissLaserPointerHoverChrome
				);
		}, [dismissLaserPointerHoverChrome]);

		const contextWindow = winContextMenu
			? (windows.find((w) => w.id === winContextMenu.windowId) ?? null)
			: null;
		const contextWindowTitle = contextWindow
			? resolveDesktopWindowDisplayTitle(contextWindow)
			: '';
		const currentDesktopIdForWindow = winContextMenu
			? desktops.find((d) => d.windows.includes(winContextMenu.windowId))?.id
			: null;
		const otherDesktops = winContextMenu
			? desktops.filter((d) => d.id !== currentDesktopIdForWindow)
			: [];
		const adjustedWinContextMenu = winContextMenu
			? getFloatingMenuPosition(
					{ x: winContextMenu.x, y: winContextMenu.y - 8 },
					{
						menuWidth: 244,
						menuHeight:
							238 +
							(otherDesktops.length > 0 ? 48 + otherDesktops.length * 42 : 0),
					}
				)
			: null;
		const adjustedStartContextMenu = startContextMenu
			? getFloatingMenuPosition(startContextMenu, {
					menuWidth: 200,
					menuHeight: 72,
				})
			: null;
		const adjustedTaskbarContextMenu = taskbarContextMenu
			? getFloatingMenuPosition(taskbarContextMenu, {
					menuWidth: 240,
					/* Трей + чекбоксы: запас по высоте, иначе getFloatingMenuPosition не «видит» вылет вниз. */
					menuHeight: currentUser ? 380 : 200,
				})
			: null;

		const performLogout = useCallback(async () => {
			if (isLoggingOut) {
				return;
			}
			setShowStart(false);
			setIsLoggingOut(true);
			try {
				await logout();
			} finally {
				setIsLoggingOut(false);
			}
		}, [isLoggingOut, logout, setShowStart]);

		const handleStartButtonContextMenu = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				e.preventDefault();
				e.stopPropagation();
				setStartContextMenu({ x: e.clientX, y: e.clientY });
			},
			[]
		);

		const { shellHydrated, quietMode } = useTaskbarShellMetaPrefs();
		const { showNudge, dismissNudge } = useDesktopWelcomeNudge(shellHydrated);
		const showWelcomeNudge =
			showNudge && !quietMode && Boolean(onOpenDesktopWelcomeTour);
		const welcomeNudgeSlotRef = useRef<HTMLDivElement>(null);
		useDesktopInViewportReachability(welcomeNudgeSlotRef, showWelcomeNudge);

		const handleWelcomeNudgeStartTour = useCallback(() => {
			dismissNudge();
			onOpenDesktopWelcomeTour?.();
		}, [dismissNudge, onOpenDesktopWelcomeTour]);

		const {
			pinnedApps,
			pinnedGafChatBadgeActive,
			pinnedFriendsBadgeActive,
			pinnedAppsBadgeTotal,
			desktopAppIds,
			taskbarWindowItems,
			overflowWindows,
			hasOverflow,
		} = useTaskbarDerivedStripData({
			apps,
			desktopItems,
			windows,
			appBadgeCounts,
		});

		return (
			<>
				<TaskbarShellContextMenus
					portalStackBase={portalStackBase}
					winContextMenu={winContextMenu}
					startContextMenu={startContextMenu}
					taskbarContextMenu={taskbarContextMenu}
					winContextMenuRef={winContextMenuRef}
					startContextMenuRef={startContextMenuRef}
					taskbarContextMenuRef={taskbarContextMenuRef}
					adjustedWinContextMenu={adjustedWinContextMenu}
					adjustedStartContextMenu={adjustedStartContextMenu}
					adjustedTaskbarContextMenu={adjustedTaskbarContextMenu}
					contextWindow={contextWindow}
					contextWindowTitle={contextWindowTitle}
					otherDesktops={otherDesktops}
					moveWindowToDesktop={moveWindowToDesktop}
					onFocusWindow={onFocusWindow}
					onWinClick={onWinClick}
					onMinimizeWindow={onMinimizeWindow}
					onToggleMaximizeWindow={onToggleMaximizeWindow}
					onCloseWindow={onCloseWindow}
					onWallpaper={onWallpaper}
					showStart={showStart}
					setShowStart={setShowStart}
					setShowNotifications={setShowNotifications}
					setShowTray={setShowTray}
					setWinContextMenu={setWinContextMenu}
					setStartContextMenu={setStartContextMenu}
					setTaskbarContextMenu={setTaskbarContextMenu}
				/>

				{/*
				 * Wave 0 / P4: seat in the same absolute space as the taskbar strip
				 * (`[data-desktop-ui-scale]`). Never `bottom-full` (legacy negative-y clip)
				 * and never viewport-`fixed` inside the scale transform.
				 * Off-viewport → `inert` via useDesktopInViewportReachability.
				 */}
				<AnimatePresence>
					{showWelcomeNudge ? (
						<div
							ref={welcomeNudgeSlotRef}
							className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2"
							style={{
								bottom: `calc(${TASKBAR.HEIGHT_PX}px + env(safe-area-inset-bottom, 0px) + 0.35rem)`,
							}}
							data-testid="desktop-welcome-nudge-slot"
						>
							<DesktopWelcomeNudgeBanner
								onStartTour={handleWelcomeNudgeStartTour}
								onDismiss={dismissNudge}
								reduceMotion={reduceMotion}
							/>
						</div>
					) : null}
				</AnimatePresence>

				{/* Full-width strip: captures all pointer events so desktop cannot receive drops/clicks in taskbar zone */}
				<m.div
					ref={taskbarStripRef}
					data-desktop-taskbar-strip
					data-desktop-chrome="full-shell-only"
					data-desktop-welcome-guide="taskbar"
					role="toolbar"
					aria-label={t('taskbar.toolbarAria')}
					variants={taskbarVariants}
					initial="hidden"
					animate="visible"
					className={`absolute bottom-0 left-0 right-0 ${heightClass} flex items-center pointer-events-auto`}
					onContextMenu={(e) => {
						if (isBrowserContextMenuAllowedTarget(e.target)) return;
						const el = getContextMenuTargetElement(e.target);
						// Interactive hosts own ПКМ (must preventDefault themselves).
						if (el?.closest('[data-taskbar-interactive="true"]')) return;
						applyDesktopContextMenuPolicy(e, { stopPropagation: false });
						setTaskbarContextMenu({ x: e.clientX, y: e.clientY });
					}}
				>
					<div
						ref={taskbarSurfaceBackdropRef}
						aria-hidden
						className={`pointer-events-none absolute inset-0 ${taskbarSurfaceClassName}`}
					/>
					{taskbarSolidOverlayOpacity > 0.008 ? (
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 z-1 rounded-t-(--desktop-radius-shell)"
							style={{
								opacity: taskbarSolidOverlayOpacity,
								/* Не смешивать с taskbarSurfaceClassName — chameleon задаёт полупрозрачный фон из CSS */
								background:
									taskbarStyleKey === 'premium'
										? 'var(--desktop-taskbar-bg-opaque-premium)'
										: 'var(--desktop-taskbar-bg-opaque)',
								backdropFilter: 'none',
								WebkitBackdropFilter: 'none',
							}}
						/>
					) : null}
					<div
						className={`relative z-10 flex h-full min-h-0 w-full items-center ${taskbar.PADDING_X} ${taskbar.GAP}`}
					>
						<TaskbarLeftCluster
							showStart={showStart}
							taskbarDividerClass={taskbarDividerClass}
							taskbarButtonSurface={taskbarButtonSurface}
							taskbarButtonActiveSurface={taskbarButtonActiveSurface}
							buttonVariants={buttonVariants}
							reduceMotion={reduceMotion}
							onStartClick={handleStartButtonClick}
							onStartContextMenu={handleStartButtonContextMenu}
						>
							{children}
						</TaskbarLeftCluster>

						<TaskbarPinnedAndWindowsStrip
							ref={pinnedWindowsStripRef}
							taskbarDividerClass={taskbarDividerClass}
							taskbarButtonSurface={taskbarButtonSurface}
							taskbarButtonActiveSurface={taskbarButtonActiveSurface}
							pinnedMenuButtonSurface={taskbarRightIconSurface}
							pinnedMenuButtonActiveSurface={taskbarRightIconActiveSurface}
							buttonVariants={buttonVariants}
							shellPanel={shellPanel}
							shellWindowStyle={shellWindowStyle}
							apps={apps}
							windows={windows}
							iconStyle={iconStyle}
							appBadgeCounts={appBadgeCounts}
							activeWindowId={activeWindowId}
							onWinClick={onWinClick}
							onOpenApp={onOpenApp}
							desktopAppIds={desktopAppIds}
							onPinAppToDesktop={onPinAppToDesktop}
							onUnpinAppFromDesktop={onUnpinAppFromDesktop}
							setWinContextMenu={setWinContextMenu}
							pinnedApps={pinnedApps}
							pinnedAppsBadgeTotal={pinnedAppsBadgeTotal}
							pinnedFriendsBadgeActive={pinnedFriendsBadgeActive}
							pinnedGafChatBadgeActive={pinnedGafChatBadgeActive}
							taskbarWindowItems={taskbarWindowItems}
							overflowWindows={overflowWindows}
							hasOverflow={hasOverflow}
							preferReducedMotion={!!reduceMotion}
						/>

						<div
							className={`w-px h-7 mx-0.5 shrink-0 ${taskbarDividerClass}`}
						/>

						{/* Right block: memo — не перерисовывается при hover на кнопках окон слева */}
						<TaskbarRightToolbar
							compact={compact}
							onShowShortcuts={onShowShortcuts}
							onOpenClipboard={onOpenClipboard}
							onOpenDesktopWelcomeTour={onOpenDesktopWelcomeTour}
							onOpenSessionInfo={onOpenSessionInfo}
							taskbarButtonSurface={taskbarRightIconSurface}
							taskbarButtonActiveSurface={taskbarRightIconActiveSurface}
							reduceMotion={reduceMotion}
							showTray={showTray}
							onToggleTray={handleToggleTray}
							onCloseTray={handleCloseTray}
							apps={apps}
							onOpenApp={onOpenApp}
							minimizedPersistentSurfaceApps={minimizedPersistentSurfaceApps}
							shellPanelStrong={shellPanelStrong}
							shellPanel={shellPanel}
							iconStyle={iconStyle}
							shellWindowStyle={shellWindowStyle}
							showNotifications={showNotifications}
							onNotificationBellClick={handleNotificationBellClick}
							onCloseNotificationPanel={handleCloseNotificationPanel}
							clockRef={clockRef}
							mountDeferredTray={mountDeferredTray}
						/>
					</div>
				</m.div>

				{/* Start Menu — chunk loads only when open */}
				{showStart ? (
					<Suspense fallback={<StartMenuSuspenseFallback />}>
						<StartMenu
							isOpen={showStart}
							onClose={() => setShowStart(false)}
							apps={apps}
							desktopItems={desktopItems}
							startMenuVirtualDesktops={desktops}
							startMenuGlobalWallpaper={startMenuGlobalWallpaper}
							desktopAppIds={desktopAppIds}
							onOpenApp={onOpenApp}
							onWallpaper={onWallpaper}
							onAppStore={onAppStore}
							onPowerOff={() => {
								void performLogout();
							}}
							onOpenProfile={onOpenProfile}
							onOpenAdmin={onOpenAdmin}
							onPinAppToDesktop={onPinAppToDesktop}
							onUnpinAppFromDesktop={onUnpinAppFromDesktop}
							onOpenAppInWorkspace={onOpenAppInWorkspace}
							recentFiles={recentFiles}
							recentLibraryOpened={recentLibraryOpened}
							recentLibraryAdded={recentLibraryAdded}
							recentLibraryGenerated={recentLibraryGenerated}
							recentLibraryUploaded={recentLibraryUploaded}
							recentLibraryProjects={recentLibraryProjects}
							recentContentFeedLoading={recentContentFeedLoading}
							recentContentFeedError={recentContentFeedError}
							recentContentFeedLoadedAt={recentContentFeedLoadedAt}
							hasRecentContentFeedItems={hasRecentContentFeedItems}
							onRefetchRecentContentFeed={onRefetchRecentContentFeed}
							onOpenShellWorkspacesSettings={onOpenShellWorkspacesSettings}
							startMenuIntent={startMenuIntent}
							onOpenRecentFile={onStartMenuOpenRecentFile}
							onRemoveRecentFile={onStartMenuRemoveRecentFile}
							startMenuActiveDesktopId={startMenuActiveDesktopId}
							storeApps={storeApps}
							iconStyle={iconStyle}
							shellWindowStyle={shellWindowStyle}
							expansionState={expansionState}
							expansionLaunchActions={expansionLaunchActions}
							resumeWindows={startMenuResumeWindows}
							onResumeOpenWindow={onStartMenuResumeOpenWindow}
							startMenuWorkspaceContextWindows={
								startMenuWorkspaceContextWindows
							}
							getWindowsOnDesktop={getWindowsOnDesktop}
						/>
					</Suspense>
				) : null}
			</>
		);
	}
);

Taskbar.displayName = 'Taskbar';

export default Taskbar;
