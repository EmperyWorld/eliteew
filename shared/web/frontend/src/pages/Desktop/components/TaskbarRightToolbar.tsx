/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Правая зона таскбара: secondary «Ещё» (Live Voice / quiet chips / tour / shortcuts),
 * attention session / clipboard / tray / notifications chips, GAF, host link, volume icon,
 * часы и «показать рабочий стол».
 *
 * Invariants:
 * - memo: при наведении на кнопки окон слева пропсы здесь не меняются — блок не перерисовывается.
 * - Session/device button открывает единый floating panel, а не отдельный popover.
 * - Clipboard / background tray / notifications: rail only on attention; otherwise «Ещё».
 * - Secondary overflow always hosts Live Voice + tour + shortcuts; quiet chips when not on rail.
 * - Warning/critical session stays on the rail (attention), not only inside «Ещё».
 * - Host network link chip always on primary rail (variant A); display-only, not mutate.
 * - Volume delegated to `taskbarStrip/TaskbarVolumeControl`; Live Voice via overflow `data-live-voice-taskbar`.
 * - GAF tray and notification details mount only after deferred Desktop runtime.
 *
 * Related:
 * - components/SessionDeviceTrayButton.tsx
 * - components/TaskbarTrayGafCluster.tsx
 * - components/TaskbarSecondaryOverflow.tsx
 * - components/TaskbarNetworkLinkChip.tsx
 * - components/taskbarStrip/TaskbarVolumeControl.tsx
 * - utils/desktopTaskbarAttentionPolicy.ts
 * - LiveVoiceDesktopPipeline.tsx, documentation/product/VOICE-CONTROL-STUDIO.md
 */

import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import { themeDesignTokens } from '@/theme/designTokens';
import { cn } from '@/utils/cn';
import { m } from 'framer-motion';
import {
	lazy,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/notifications';
import type { DesktopIconStyle, DesktopWindowStyle } from '@/types/profile';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useFinePointerHover } from '../hooks/useFinePointerHover';
import { useDesktopTrayItems } from '../hooks/useDesktopTrayItems';
import type { DesktopItem } from '../types/desktop.types';
import { useDesktopClipboardHistoryOptional } from '../context/DesktopClipboardHistoryContext';
import {
	CLIPBOARD_RAIL_ATTENTION_MS,
	backgroundTrayNeedsRailAttention,
	clipboardNeedsRailAttention,
	newestClipboardTimestamp,
	notificationsNeedRailAttention,
} from '../utils/desktopTaskbarAttentionPolicy';
import { DesktopAppMenuDivider, DesktopAppMenuItem } from './DesktopAppChrome';
import { TaskbarClock, type TaskbarClockHandle } from './TaskbarClock';
import { TaskbarNetworkLinkChip } from './TaskbarNetworkLinkChip';
import {
	TaskbarIconContextMenu,
	type TaskbarIconContextMenuPoint,
} from './TaskbarIconContextMenu';
import { SessionDeviceTrayButton } from './SessionDeviceTrayButton';
import { DesktopTaskbarRecoveryChip } from './DesktopTaskbarRecoveryChip';
import { TaskbarSecondaryOverflow } from './TaskbarSecondaryOverflow';
import { DesktopDeferredMount } from './DesktopDeferredMount';
import { ArrowDownTrayIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import { useDesktopVoice } from '../context/DesktopVoiceContext';
import { useSessionDeviceHealth } from '@/components/ui/useSessionDeviceHealth';
import { useSocketConnectionState } from '@/services/communication/socketConnectionStore';

const TaskbarTrayGafCluster = lazy(() =>
	import('./TaskbarTrayGafCluster').then((m) => ({
		default: m.TaskbarTrayGafCluster,
	}))
);
const TaskbarNotificationCluster = lazy(() =>
	import('./TaskbarNotificationCluster').then((m) => ({
		default: m.TaskbarNotificationCluster,
	}))
);
const TaskbarVolumeControl = lazy(() =>
	import('./taskbarStrip/TaskbarVolumeControl').then((m) => ({
		default: m.TaskbarVolumeControl,
	}))
);

export type TaskbarRightToolbarProps = {
	/** Compact/mobile taskbar — tour button stays icon-only. */
	compact?: boolean;
	onShowShortcuts?: () => void;
	onOpenClipboard?: () => void;
	onOpenDesktopWelcomeTour?: () => void;
	onOpenSessionInfo?: () => void;
	taskbarButtonSurface: string;
	taskbarButtonActiveSurface: string;
	reduceMotion: boolean | null;
	showTray: boolean;
	onToggleTray: () => void;
	onCloseTray: () => void;
	apps: DesktopItem[];
	onOpenApp: (app: DesktopItem) => void;
	minimizedPersistentSurfaceApps?: ReadonlySet<string>;
	shellPanelStrong: string;
	shellPanel: string;
	iconStyle: DesktopIconStyle;
	shellWindowStyle: DesktopWindowStyle;
	showNotifications: boolean;
	onNotificationBellClick: () => void;
	onCloseNotificationPanel: () => void;
	clockRef: RefObject<TaskbarClockHandle | null>;
	/** GAF tray + notification details wait for deferred Desktop runtime. */
	mountDeferredTray?: boolean;
};

export const TaskbarRightToolbar = memo(function TaskbarRightToolbar({
	compact: _compact = false,
	onShowShortcuts,
	onOpenClipboard,
	onOpenDesktopWelcomeTour,
	onOpenSessionInfo,
	taskbarButtonSurface,
	taskbarButtonActiveSurface,
	reduceMotion,
	showTray,
	onToggleTray,
	onCloseTray,
	apps,
	onOpenApp,
	minimizedPersistentSurfaceApps,
	shellPanelStrong,
	shellPanel,
	iconStyle,
	shellWindowStyle,
	showNotifications,
	onNotificationBellClick,
	onCloseNotificationPanel,
	clockRef,
	mountDeferredTray = false,
}: TaskbarRightToolbarProps) {
	const { t } = useTranslation('desktopUi');
	const desktopVoice = useDesktopVoice();
	const liveVoicePanelOpen = desktopVoice.showLiveVoicePanel;
	const liveVoiceModeOn = desktopVoice.activeMode === 'live-voice';
	const { taskbar } = themeDesignTokens.desktop;
	const finePointerHover = useFinePointerHover();
	const { user: currentUser } = useAuth();
	const [toolbarContextMenu, setToolbarContextMenu] = useState<{
		kind: 'shortcuts' | 'show-desktop';
		point: TaskbarIconContextMenuPoint;
	} | null>(null);
	const [clipboardAttentionNowMs, setClipboardAttentionNowMs] = useState(() =>
		Date.now()
	);

	const closeToolbarContextMenu = useCallback(() => {
		setToolbarContextMenu(null);
	}, []);

	const dispatchShowDesktop = useCallback(() => {
		window.dispatchEvent(new CustomEvent('desktop-show-desktop'));
	}, []);

	const { connected: socketConnected } = useSocketConnectionState();
	const sessionHealth = useSessionDeviceHealth({
		realtimeConnected: socketConnected,
	});
	const sessionNeedsAttention =
		sessionHealth.level === 'warning' || sessionHealth.level === 'critical';

	const { unreadCount } = useNotifications();
	const clipboardEngine = useDesktopClipboardHistoryOptional();
	const traySnapshot = useDesktopTrayItems({
		minimizedPersistent: minimizedPersistentSurfaceApps,
	});

	const newestClipboard = useMemo(
		() => newestClipboardTimestamp(clipboardEngine?.history ?? []),
		[clipboardEngine?.history]
	);

	useEffect(() => {
		if (!newestClipboard) {
			setClipboardAttentionNowMs(Date.now());
			return;
		}
		const raw = newestClipboard;
		const ms =
			raw instanceof Date
				? raw.getTime()
				: typeof raw === 'string'
					? Date.parse(raw)
					: Number.NaN;
		if (!Number.isFinite(ms)) return;
		const remaining = ms + CLIPBOARD_RAIL_ATTENTION_MS - Date.now();
		setClipboardAttentionNowMs(Date.now());
		if (remaining <= 0) return;
		const timer = window.setTimeout(() => {
			setClipboardAttentionNowMs(Date.now());
		}, remaining + 16);
		return () => window.clearTimeout(timer);
	}, [newestClipboard]);

	const clipboardNeedsAttention = clipboardNeedsRailAttention({
		newestTimestamp: newestClipboard,
		nowMs: clipboardAttentionNowMs,
	});

	const notificationsNeedsAttention = notificationsNeedRailAttention({
		unreadCount,
		panelOpen: showNotifications,
	});

	const trayNeedsAttention = backgroundTrayNeedsRailAttention({
		gafUnread: traySnapshot.gafUnread,
		friendsIncomingCount: traySnapshot.friendsIncomingCount,
		ugsActiveTaskCount: traySnapshot.ugsActiveTaskCount,
		musicPlaybackError: traySnapshot.musicPlaybackErrorActive,
		ugsTrayPollError: traySnapshot.ugsTrayPollError,
		panelOpen: showTray,
	});

	const toggleLiveVoice = useCallback(() => {
		if (liveVoicePanelOpen) {
			desktopVoice.setShowLiveVoicePanel(false);
		} else {
			desktopVoice.enableLiveVoice();
		}
	}, [desktopVoice, liveVoicePanelOpen]);

	const liveVoiceActive = liveVoicePanelOpen || liveVoiceModeOn;

	return (
		<div className={`flex shrink-0 items-center self-stretch ${taskbar.GAP}`}>
			<TaskbarSecondaryOverflow
				onOpenDesktopWelcomeTour={onOpenDesktopWelcomeTour}
				onShowShortcuts={onShowShortcuts}
				onToggleLiveVoice={toggleLiveVoice}
				liveVoiceActive={liveVoiceActive}
				onOpenSessionInfo={onOpenSessionInfo}
				includeSessionInMenu={!sessionNeedsAttention}
				onOpenClipboard={onOpenClipboard}
				includeClipboardInMenu={!clipboardNeedsAttention}
				onToggleTray={onToggleTray}
				includeTrayInMenu={mountDeferredTray && !trayNeedsAttention}
				onOpenNotifications={onNotificationBellClick}
				includeNotificationsInMenu={
					mountDeferredTray && !notificationsNeedsAttention
				}
				taskbarButtonSurface={taskbarButtonSurface}
				taskbarButtonActiveSurface={taskbarButtonActiveSurface}
				reduceMotion={reduceMotion}
			/>

			<DesktopTaskbarRecoveryChip />

			{sessionNeedsAttention ? (
				<SessionDeviceTrayButton
					onOpenSessionInfo={onOpenSessionInfo}
					taskbarButtonSurface={taskbarButtonSurface}
					taskbarButtonActiveSurface={taskbarButtonActiveSurface}
					reduceMotion={reduceMotion}
				/>
			) : null}

			<DesktopDeferredMount active={mountDeferredTray}>
				<TaskbarTrayGafCluster
					showTray={showTray}
					onToggleTray={onToggleTray}
					onCloseTray={onCloseTray}
					apps={apps}
					onOpenApp={onOpenApp}
					minimizedPersistentSurfaceApps={minimizedPersistentSurfaceApps}
					hasCurrentUser={!!currentUser}
					shellPanelStrong={shellPanelStrong}
					iconStyle={iconStyle}
					taskbarButtonSurface={taskbarButtonSurface}
					taskbarButtonActiveSurface={taskbarButtonActiveSurface}
					reduceMotion={reduceMotion}
					showTrayChipOnRail={trayNeedsAttention}
				/>
			</DesktopDeferredMount>

			{clipboardNeedsAttention ? (
				<DesktopChromeTooltip
					content={t('taskbar.openClipboard')}
					placement="top"
					offsetExtra={12}
				>
					<m.button
						data-taskbar-interactive="true"
						data-taskbar-clipboard-rail="true"
						type="button"
						className={cn(
							`relative ${taskbar.HIT_MIN_CLASS} shrink-0 cursor-pointer p-1.5 rounded-lg border-0`,
							taskbar.ICON_FOCUS,
							taskbarButtonSurface
						)}
						aria-label={t('taskbar.openClipboard')}
						disabled={!onOpenClipboard}
						onClick={() => {
							onOpenClipboard?.();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onOpenClipboard?.();
							}
						}}
						whileTap={reduceMotion ? undefined : { scale: 0.94 }}
						transition={{ duration: 0.12 }}
					>
						<ClipboardIcon className="h-5 w-5" aria-hidden />
					</m.button>
				</DesktopChromeTooltip>
			) : null}

			<DesktopDeferredMount active={mountDeferredTray}>
				<TaskbarNotificationCluster
					showNotifications={showNotifications}
					onBellClick={onNotificationBellClick}
					onClosePanel={onCloseNotificationPanel}
					shellWindowStyle={shellWindowStyle}
					taskbarButtonSurface={taskbarButtonSurface}
					taskbarButtonActiveSurface={taskbarButtonActiveSurface}
					reduceMotion={reduceMotion}
					showBellOnRail={notificationsNeedsAttention}
				/>
			</DesktopDeferredMount>

			<TaskbarNetworkLinkChip
				taskbarButtonSurface={taskbarButtonSurface}
				reduceMotion={reduceMotion}
			/>

			<DesktopDeferredMount active={mountDeferredTray}>
				<TaskbarVolumeControl taskbarButtonSurface={taskbarButtonSurface} />
			</DesktopDeferredMount>

			<TaskbarClock
				ref={clockRef}
				taskbarButtonSurface={taskbarButtonSurface}
				taskbarButtonActiveSurface={taskbarButtonActiveSurface}
				shellPanel={shellPanel}
			/>

			<DesktopChromeTooltip
				content={t('taskbar.showDesktopStrip')}
				placement="top"
				offsetExtra={12}
			>
				<m.button
					data-taskbar-interactive="true"
					type="button"
					className={cn(
						`relative ${taskbar.HIT_MIN_CLASS} shrink-0 cursor-pointer p-1.5 rounded-lg border-0`,
						taskbar.ICON_FOCUS,
						taskbarButtonSurface
					)}
					aria-label={t('taskbar.showDesktopStrip')}
					onClick={() => {
						dispatchShowDesktop();
					}}
					onContextMenu={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setToolbarContextMenu({
							kind: 'show-desktop',
							point: { x: event.clientX, y: event.clientY },
						});
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							dispatchShowDesktop();
						}
					}}
					whileHover={
						finePointerHover && !reduceMotion ? { scale: 1.02 } : undefined
					}
				>
					<ArrowDownTrayIcon
						className={taskbar.ICON_CLASS}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</m.button>
			</DesktopChromeTooltip>
			<TaskbarIconContextMenu
				point={toolbarContextMenu?.point ?? null}
				onClose={closeToolbarContextMenu}
				menuWidth={224}
				menuHeight={toolbarContextMenu?.kind === 'show-desktop' ? 118 : 86}
				className="min-w-[224px]"
			>
				{toolbarContextMenu?.kind === 'show-desktop' ? (
					<>
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								dispatchShowDesktop();
								closeToolbarContextMenu();
							}}
						>
							{t('taskbar.trayContextShowDesktop')}
						</DesktopAppMenuItem>
						<DesktopAppMenuDivider />
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							disabled={!onShowShortcuts}
							onClick={() => {
								onShowShortcuts?.();
								closeToolbarContextMenu();
							}}
						>
							{t('taskbar.trayContextOpenShortcuts')}
						</DesktopAppMenuItem>
					</>
				) : (
					<DesktopAppMenuItem
						type="button"
						role="menuitem"
						onClick={() => {
							onShowShortcuts?.();
							closeToolbarContextMenu();
						}}
					>
						{t('taskbar.trayContextOpenShortcuts')}
					</DesktopAppMenuItem>
				)}
			</TaskbarIconContextMenu>
		</div>
	);
});
