/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar Start / tray / notification-center exclusivity, deep-link events,
 * and Escape handling for shell popovers (defers when Start, hub, tray, clock,
 * context menus, or shell overlays own the key).
 *
 * Invariants:
 * - Opening Start, tray, or notifications closes the other two.
 * - Escape on taskbar context menus closes the top menu first; shell popovers
 *   close only when no ctx menu is open.
 * - Start Menu open, clock flyout, tray panel, and shellOverlayConsumesEscape
 *   defer taskbar popover Escape.
 *
 * Related:
 * - components/Taskbar.tsx
 * - utils/desktopDeepLink.ts
 */

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type RefObject,
} from 'react';
import type { TaskbarClockHandle } from '../components/TaskbarClock';
import type { TaskbarPinnedAndWindowsStripHandle } from '../components/TaskbarPinnedAndWindowsStrip';
import type { StartMenuTab } from '../types/desktopStartMenu';
import { isStartMenuTab } from '../types/desktopStartMenu';
import {
	DESKTOP_CLOSE_START_MENU_EVENT,
	DESKTOP_OPEN_START_MENU_EVENT,
	DESKTOP_TOGGLE_NOTIFICATIONS_EVENT,
} from '../utils/desktopDeepLink';
import { shouldDeferDesktopShellKeydownToFocusedSurface } from '../utils/desktopShellKeyboardCapture';

export type TaskbarContextMenuOpenFlags = {
	winContextMenu: unknown;
	startContextMenu: unknown;
	taskbarContextMenu: unknown;
};

export type UseTaskbarPopoverControllerArgs = {
	notificationCenterOpenNonce?: number;
	shellOverlayConsumesEscape?: boolean;
	clockRef: RefObject<TaskbarClockHandle | null>;
	pinnedWindowsStripRef: MutableRefObject<TaskbarPinnedAndWindowsStripHandle | null>;
	contextMenus: TaskbarContextMenuOpenFlags;
};

export function useTaskbarPopoverController({
	notificationCenterOpenNonce = 0,
	shellOverlayConsumesEscape = false,
	clockRef,
	pinnedWindowsStripRef,
	contextMenus,
}: UseTaskbarPopoverControllerArgs) {
	const [showStart, setShowStart] = useState(false);
	const [startMenuIntent, setStartMenuIntent] = useState<{
		tab: StartMenuTab;
		nonce: number;
	}>({ tab: 'home', nonce: 0 });
	const [showNotifications, setShowNotifications] = useState(false);
	const [showTray, setShowTray] = useState(false);
	const lastNotificationOpenNonce = useRef(0);

	const { winContextMenu, startContextMenu, taskbarContextMenu } = contextMenus;

	useEffect(() => {
		const openStart = (event: Event) => {
			const tab = (event as CustomEvent<{ tab?: unknown }>).detail?.tab;
			if (isStartMenuTab(tab)) {
				setStartMenuIntent((current) => ({
					tab,
					nonce: current.nonce + 1,
				}));
			}
			setShowStart(true);
			setShowNotifications(false);
			setShowTray(false);
		};
		const closeStart = () => {
			setShowStart(false);
			setShowNotifications(false);
		};
		const toggleNotifications = () => {
			setShowNotifications((v) => {
				const next = !v;
				if (next) {
					setShowTray(false);
					setShowStart(false);
				}
				return next;
			});
		};
		window.addEventListener(DESKTOP_OPEN_START_MENU_EVENT, openStart);
		window.addEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeStart);
		window.addEventListener(
			DESKTOP_TOGGLE_NOTIFICATIONS_EVENT,
			toggleNotifications
		);
		return () => {
			window.removeEventListener(DESKTOP_OPEN_START_MENU_EVENT, openStart);
			window.removeEventListener(DESKTOP_CLOSE_START_MENU_EVENT, closeStart);
			window.removeEventListener(
				DESKTOP_TOGGLE_NOTIFICATIONS_EVENT,
				toggleNotifications
			);
		};
	}, []);

	useEffect(() => {
		if (notificationCenterOpenNonce <= lastNotificationOpenNonce.current)
			return;
		lastNotificationOpenNonce.current = notificationCenterOpenNonce;
		setShowNotifications(true);
		setShowTray(false);
		setShowStart(false);
	}, [notificationCenterOpenNonce]);

	const handleToggleTray = useCallback(() => {
		setShowTray((v) => {
			const next = !v;
			if (next) {
				setShowNotifications(false);
				setShowStart(false);
			}
			return next;
		});
	}, []);

	const handleCloseTray = useCallback(() => {
		setShowTray(false);
	}, []);

	const handleNotificationBellClick = useCallback(() => {
		setShowNotifications((v) => {
			const next = !v;
			if (next) {
				setShowTray(false);
				setShowStart(false);
			}
			return next;
		});
	}, []);

	const handleCloseNotificationPanel = useCallback(() => {
		setShowNotifications(false);
	}, []);

	const handleStartButtonClick = useCallback(() => {
		setShowStart((v) => !v);
		setShowNotifications(false);
		setShowTray(false);
	}, []);

	// Close taskbar popovers on Escape when no modal/context menu owns the key.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (shellOverlayConsumesEscape) return;
			if (shouldDeferDesktopShellKeydownToFocusedSurface()) return;
			if (showStart) return;
			if (showNotifications) return;
			if (showTray) return;
			if (clockRef.current?.isMenuOpen()) return;
			if (
				winContextMenu != null ||
				startContextMenu != null ||
				taskbarContextMenu != null
			) {
				return;
			}
			setShowStart(false);
			pinnedWindowsStripRef.current?.closeFlyouts();
			clockRef.current?.closeMenu();
			setShowNotifications(false);
			setShowTray(false);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [
		shellOverlayConsumesEscape,
		showStart,
		showNotifications,
		showTray,
		startContextMenu,
		taskbarContextMenu,
		winContextMenu,
		clockRef,
		pinnedWindowsStripRef,
	]);

	return {
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
	};
}
