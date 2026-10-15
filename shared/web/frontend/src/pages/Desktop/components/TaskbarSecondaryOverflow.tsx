/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar secondary cluster («More»): Live Voice, session (when healthy), clipboard /
 * background processes / notifications (when quiet), guided tour, and keyboard shortcuts —
 * keeps the primary tray uncluttered until attention events.
 *
 * Invariants:
 * - Primary notify/volume/clock/GAF-tray stay outside this menu when on rail.
 * - Session / clipboard / tray / notifications enter this menu only when not attention-gated on rail.
 * - Menu uses TaskbarIconContextMenu Escape/outside-dismiss and focus-first menuitem.
 * - Welcome-guide anchors remain on menu items (`taskbar-tour-launch`, `shortcuts`).
 * - Tour launch copy is `welcomeOnboarding.guide.menuLabel` («Тур по приложению»), not per-app «Экскурсия».
 *
 * Related:
 * - TaskbarRightToolbar.tsx
 * - utils/desktopTaskbarAttentionPolicy.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { m } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { themeDesignTokens } from '@/theme/designTokens';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE } from '../constants';
import { useFinePointerHover } from '../hooks/useFinePointerHover';
import { useDesktopWelcomeTourStep } from '../hooks/useDesktopWelcomeTourSession';
import { welcomeTourNeedsShortcutsMenu } from './desktopWelcomeTourSession';
import { DesktopAppMenuItem } from './DesktopAppChrome';
import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import {
	TaskbarIconContextMenu,
	type TaskbarIconContextMenuPoint,
} from './TaskbarIconContextMenu';

export type TaskbarSecondaryOverflowProps = {
	onShowShortcuts?: () => void;
	onOpenDesktopWelcomeTour?: () => void;
	onToggleLiveVoice?: () => void;
	liveVoiceActive?: boolean;
	/** When true, session opens from this menu (healthy path). */
	onOpenSessionInfo?: () => void;
	includeSessionInMenu?: boolean;
	onOpenClipboard?: () => void;
	includeClipboardInMenu?: boolean;
	onToggleTray?: () => void;
	includeTrayInMenu?: boolean;
	onOpenNotifications?: () => void;
	includeNotificationsInMenu?: boolean;
	taskbarButtonSurface: string;
	taskbarButtonActiveSurface?: string;
	reduceMotion: boolean | null;
};

const MENU_ITEM_HEIGHT = 40;
const MENU_PAD = 16;

export const TaskbarSecondaryOverflow = memo(function TaskbarSecondaryOverflow({
	onShowShortcuts,
	onOpenDesktopWelcomeTour,
	onToggleLiveVoice,
	liveVoiceActive = false,
	onOpenSessionInfo,
	includeSessionInMenu = false,
	onOpenClipboard,
	includeClipboardInMenu = false,
	onToggleTray,
	includeTrayInMenu = false,
	onOpenNotifications,
	includeNotificationsInMenu = false,
	taskbarButtonSurface,
	taskbarButtonActiveSurface,
	reduceMotion,
}: TaskbarSecondaryOverflowProps) {
	const { t } = useTranslation('desktopUi');
	const { taskbar } = themeDesignTokens.desktop;
	const finePointerHover = useFinePointerHover();
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const [menuPoint, setMenuPoint] =
		useState<TaskbarIconContextMenuPoint | null>(null);
	const menuOpen = menuPoint != null;

	const closeMenu = useCallback(() => setMenuPoint(null), []);

	const openMenu = useCallback(() => {
		const el = triggerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setMenuPoint((prev) =>
			prev
				? null
				: {
						x: rect.left + rect.width / 2,
						y: rect.top,
					}
		);
	}, []);

	const welcomeTourStep = useDesktopWelcomeTourStep();
	useEffect(() => {
		if (!welcomeTourNeedsShortcutsMenu(welcomeTourStep)) {
			return;
		}
		const el = triggerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setMenuPoint({
			x: rect.left + rect.width / 2,
			y: rect.top,
		});
		return () => {
			setMenuPoint(null);
		};
	}, [welcomeTourStep]);

	const hasLiveVoice = Boolean(onToggleLiveVoice);
	const hasSession = includeSessionInMenu && Boolean(onOpenSessionInfo);
	const hasClipboard = includeClipboardInMenu && Boolean(onOpenClipboard);
	const hasTray = includeTrayInMenu && Boolean(onToggleTray);
	const hasNotifications =
		includeNotificationsInMenu && Boolean(onOpenNotifications);
	const hasTour = Boolean(onOpenDesktopWelcomeTour);
	const hasShortcuts = Boolean(onShowShortcuts);
	const itemCount =
		Number(hasLiveVoice) +
		Number(hasSession) +
		Number(hasClipboard) +
		Number(hasTray) +
		Number(hasNotifications) +
		Number(hasTour) +
		Number(hasShortcuts);

	const menuHeight = useMemo(
		() =>
			Math.max(
				MENU_PAD + MENU_ITEM_HEIGHT,
				itemCount * MENU_ITEM_HEIGHT + MENU_PAD
			),
		[itemCount]
	);

	if (itemCount === 0) return null;

	const triggerSurface =
		liveVoiceActive && taskbarButtonActiveSurface
			? taskbarButtonActiveSurface
			: taskbarButtonSurface;

	return (
		<>
			<DesktopChromeTooltip
				content={t('taskbar.secondaryOverflowTooltip')}
				placement="top"
				offsetExtra={12}
			>
				<m.button
					ref={triggerRef}
					data-taskbar-interactive="true"
					data-taskbar-secondary-overflow="true"
					data-desktop-welcome-guide="taskbar-secondary-overflow"
					type="button"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					aria-label={t('taskbar.secondaryOverflowAria')}
					onClick={openMenu}
					onContextMenu={(e) => {
						e.preventDefault();
						e.stopPropagation();
						openMenu();
					}}
					className={cn(
						`${taskbar.HIT_MIN_CLASS} p-1.5 rounded-lg ${taskbar.ICON_FOCUS}`,
						triggerSurface
					)}
					whileHover={
						finePointerHover && !reduceMotion ? { scale: 1.02 } : undefined
					}
				>
					<EllipsisHorizontalIcon
						className={taskbar.ICON_CLASS}
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</m.button>
			</DesktopChromeTooltip>
			<TaskbarIconContextMenu
				point={menuPoint}
				onClose={closeMenu}
				menuWidth={260}
				menuHeight={menuHeight}
			>
				{hasLiveVoice ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-live-voice-taskbar="true"
						aria-pressed={liveVoiceActive}
						onClick={() => {
							closeMenu();
							onToggleLiveVoice?.();
						}}
					>
						{liveVoiceActive
							? t('taskbar.liveVoiceCloseTooltip')
							: t('taskbar.liveVoiceOpenTooltip')}
					</DesktopAppMenuItem>
				) : null}
				{hasSession ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-taskbar-session-overflow="true"
						onClick={() => {
							closeMenu();
							onOpenSessionInfo?.();
						}}
					>
						{t('taskbar.sessionDeviceTitle')}
					</DesktopAppMenuItem>
				) : null}
				{hasClipboard ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-taskbar-clipboard-overflow="true"
						onClick={() => {
							closeMenu();
							onOpenClipboard?.();
						}}
					>
						{t('taskbar.openClipboard')}
					</DesktopAppMenuItem>
				) : null}
				{hasTray ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-taskbar-tray-overflow="true"
						onClick={() => {
							closeMenu();
							onToggleTray?.();
						}}
					>
						{t('taskbar.trayHeadline')}
					</DesktopAppMenuItem>
				) : null}
				{hasNotifications ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-taskbar-notifications-overflow="true"
						onClick={() => {
							closeMenu();
							onOpenNotifications?.();
						}}
					>
						{t('taskbar.notifications')}
					</DesktopAppMenuItem>
				) : null}
				{hasTour ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-desktop-welcome-guide="taskbar-tour-launch"
						onClick={() => {
							closeMenu();
							onOpenDesktopWelcomeTour?.();
						}}
					>
						{t('welcomeOnboarding.guide.menuLabel')}
					</DesktopAppMenuItem>
				) : null}
				{hasShortcuts ? (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						data-desktop-welcome-guide="shortcuts"
						onClick={() => {
							closeMenu();
							onShowShortcuts?.();
						}}
					>
						{t('taskbar.shortcutsAria')}
					</DesktopAppMenuItem>
				) : null}
			</TaskbarIconContextMenu>
		</>
	);
});
