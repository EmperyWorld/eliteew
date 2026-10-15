/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single notification row for the hub (panel compact or full window).
 *
 * Invariants:
 * - Type/source semantic colors come from notificationHubStyles.ts; layout from notificationHubLayoutTokens.ts.
 *
 * Related:
 * - NotificationHubBody.tsx, notificationHubLayoutTokens.ts, notificationHubStyles.ts
 * - hooks/useNotificationHubPanelItemKeyboardNav.ts
 * - DesktopChromeTooltip.tsx
 */

import type { Notification } from '@/notifications';
import { executeServerNotificationAction } from '@/notifications/executeServerNotificationAction';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { cn } from '@/utils/cn';
import { m } from 'framer-motion';
import { useDesktopShellMotionPrefs } from '../../context/DesktopShellMotionPrefsContext';
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE, DESKTOP_LUCIDE } from '../../constants';
import { useShellPortal } from '../../shell/shellPortal';
import { getFloatingMenuPosition } from '../../utils/desktopUi';
import {
	DesktopAppButton,
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
	DesktopAppStatusBadge,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { requestOpenDesktopApp } from '../../utils/desktopDeepLink';
import { getNotificationSourceI18nKey } from '@/notifications/sourceMeta';
import {
	ArrowTopRightOnSquareIcon,
	CheckIcon,
	ClockIcon,
	DocumentDuplicateIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	getNotificationSourceVisual,
	notificationIconWellClass,
	notificationStyles,
} from './notificationHubStyles';
import {
	nhItemCardShellClass,
	nhItemCompactMetaClass,
	nhItemContentRowClass,
	nhItemDismissButtonClass,
	nhItemIconWellShellClass,
	nhItemLegacyActionButtonClass,
	nhItemMessageClass,
	nhItemMetaFooterClass,
	nhItemPinnedBadgeClass,
	nhItemSecondaryServerActionClass,
	nhItemServerActionButtonClass,
	nhItemServerActionsRowClass,
	nhItemSourceBadgeClass,
	nhItemSourceMetaRowClass,
	nhItemTitleClass,
	nhItemUnreadDotClass,
	NH_ITEM_NEW_BADGE_CLASS,
} from './notificationHubLayoutTokens';
import { formatDesktopRelativeTimeAgo } from '../../utils/desktopRelativeTime';
import { applyDesktopContextMenuPolicy } from '../../utils/desktopContextMenuPolicy';

function isInnerInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest(
			'button, a, input, select, textarea, [role="button"], [role="link"]'
		)
	);
}

function useNotificationTimeAgo() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
	return useCallback(
		(date: Date) => formatDesktopRelativeTimeAgo(date, t),
		[t]
	);
}

export const NotificationHubItem: FC<{
	notification: Notification;
	onMarkAsRead: (id: string) => void;
	onDismiss: (id: string) => void;
	compact?: boolean;
	/** Changes periodically so relative time strings refresh */
	timeRefreshKey?: number;
}> = memo(
	({
		notification,
		onMarkAsRead,
		onDismiss,
		compact,
		timeRefreshKey: _timeRefreshKey,
	}) => {
		const { t } = useTranslation('desktopUi', { keyPrefix: 'notificationHub' });
		const { reduceMotion } = useDesktopShellMotionPrefs();
		const style = notificationStyles[notification.type];
		const Icon = style.icon;
		const timeAgo = useNotificationTimeAgo();
		const groupLabel = t(`groups.${notification.type}`);
		const useLayout = !compact && !reduceMotion;
		const [busyAction, setBusyAction] = useState<string | null>(null);
		const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
			null
		);
		const ctxMenuRef = useRef<HTMLDivElement>(null);
		const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
		const { Portal, portalProps } = useShellPortal({
			layer: 'embedded_popover',
			dismissOnEscape: false,
			trapFocus: false,
			onDismiss: closeCtxMenu,
		});
		const sourceVisual = getNotificationSourceVisual(notification.source);
		const sourceLabel = notification.source
			? t(getNotificationSourceI18nKey(notification.source))
			: null;
		const itemAriaLabel = useMemo(() => {
			if (notification.read) return notification.title;
			return `${notification.title}, ${t('newBadge')}`;
		}, [notification.read, notification.title, t]);
		const handleActivate = useCallback(() => {
			if (notification.openApp) {
				requestOpenDesktopApp(notification.openApp);
			}
			if (!notification.read) onMarkAsRead(notification.id);
		}, [notification, onMarkAsRead]);

		const runServerAction = useCallback(
			async (actionId: string) => {
				if (!actionId.trim()) return;
				setBusyAction(actionId);
				try {
					await executeServerNotificationAction(notification, actionId);
				} finally {
					setBusyAction(null);
				}
			},
			[notification]
		);

		useEffect(() => {
			if (!ctxMenu) return;
			const onDoc = (ev: MouseEvent) => {
				if (ctxMenuRef.current?.contains(ev.target as Node)) return;
				closeCtxMenu();
			};
			const onKey = (ev: KeyboardEvent) => {
				if (ev.key === 'Escape') closeCtxMenu();
			};
			document.addEventListener('mousedown', onDoc);
			document.addEventListener('keydown', onKey);
			return () => {
				document.removeEventListener('mousedown', onDoc);
				document.removeEventListener('keydown', onKey);
			};
		}, [ctxMenu, closeCtxMenu]);

		const ctxMenuPortal =
			ctxMenu && typeof document !== 'undefined' ? (
				<Portal>
					<div
						ref={ctxMenuRef}
						role="menu"
						aria-label={t('ctxMenuAria')}
						className="fixed text-(--desktop-text-primary)"
						style={{
							...(() => {
								const p = getFloatingMenuPosition(
									{ x: ctxMenu.x, y: ctxMenu.y },
									{ menuWidth: 220, menuHeight: 200, preferAbove: true }
								);
								return { left: p.x, top: p.y };
							})(),
							zIndex: portalProps?.zIndex,
						}}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<DesktopAppMenuSurface className="min-w-[200px] ring-1 ring-(--desktop-border-menu)">
							<DesktopAppMenuItem
								type="button"
								icon={
									<ArrowTopRightOnSquareIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									handleActivate();
									closeCtxMenu();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('ctxOpen')}
							</DesktopAppMenuItem>
							{!notification.read ? (
								<DesktopAppMenuItem
									type="button"
									icon={
										<CheckIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									}
									onClick={() => {
										onMarkAsRead(notification.id);
										closeCtxMenu();
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('ctxMarkRead')}
								</DesktopAppMenuItem>
							) : null}
							<DesktopAppMenuItem
								type="button"
								icon={
									<DocumentDuplicateIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									void safeCopyToClipboard(notification.title);
									closeCtxMenu();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('ctxCopyTitle')}
							</DesktopAppMenuItem>
							<DesktopAppMenuDivider />
							<DesktopAppMenuItem
								type="button"
								tone="danger"
								icon={
									<XMarkIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									onDismiss(notification.id);
									closeCtxMenu();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('ctxDismiss')}
							</DesktopAppMenuItem>
						</DesktopAppMenuSurface>
					</div>
				</Portal>
			) : null;

		return (
			<>
				<m.div
					layout={useLayout}
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -20, height: 0 }}
					className={nhItemCardShellClass(
						Boolean(compact),
						style.bg,
						style.border,
						sourceVisual.containerTone,
						!notification.read
					)}
					data-notification-hub-item=""
					role="button"
					tabIndex={0}
					aria-label={itemAriaLabel}
					onClick={handleActivate}
					onContextMenu={(e) => {
						// Always suppress native; open hub menu only on non-inner chrome.
						applyDesktopContextMenuPolicy(e);
						if (isInnerInteractiveTarget(e.target)) return;
						setCtxMenu({ x: e.clientX, y: e.clientY });
					}}
					onKeyDown={(e) => {
						if (isInnerInteractiveTarget(e.target)) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleActivate();
						}
					}}
				>
					{!notification.read && (
						<div
							className={nhItemUnreadDotClass(Boolean(compact))}
							aria-hidden
						/>
					)}

					<div className={nhItemContentRowClass(Boolean(compact))}>
						<div
							className={nhItemIconWellShellClass(
								Boolean(compact),
								notificationIconWellClass,
								sourceVisual.iconTone
							)}
						>
							{notification.icon || (
								<Icon
									className={cn(
										style.iconColor,
										compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
									)}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
						</div>

						<div className="min-w-0 flex-1">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<h4 className={nhItemTitleClass(Boolean(compact))}>
										{notification.title}
									</h4>
									{notification.persistent && !compact && (
										<div className="mt-0.5">
											<DesktopAppStatusBadge
												className={nhItemPinnedBadgeClass()}
											>
												{t('pinnedBadge')}
											</DesktopAppStatusBadge>
										</div>
									)}
									{notification.source && !compact && (
										<div className={nhItemSourceMetaRowClass()}>
											<DesktopAppStatusBadge
												className={nhItemSourceBadgeClass(
													sourceVisual.badgeTone
												)}
											>
												{sourceLabel}
											</DesktopAppStatusBadge>
											<span className="text-(--desktop-text-dim)">·</span>
											<span className="capitalize text-(--desktop-text-muted)">
												{groupLabel}
											</span>
										</div>
									)}
									{notification.source && compact && (
										<p className={nhItemCompactMetaClass()}>
											{sourceLabel} · {groupLabel}
											{notification.persistent ? ` · ${t('pinnedBadge')}` : ''}
										</p>
									)}
									{notification.persistent &&
										compact &&
										!notification.source && (
											<p className={nhItemCompactMetaClass()}>
												{t('pinnedBadge')}
											</p>
										)}
								</div>
								<DesktopChromeTooltip
									content={t('ctxDismiss')}
									placement="top"
									offsetExtra={4}
								>
									<DesktopAppButton
										onClick={(e) => {
											e.stopPropagation();
											onDismiss(notification.id);
										}}
										variant="ghost"
										size="icon"
										className={nhItemDismissButtonClass(Boolean(compact))}
										aria-label={t('ctxDismiss')}
									>
										<XMarkIcon
											className={DESKTOP_LUCIDE.sm}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</DesktopAppButton>
								</DesktopChromeTooltip>
							</div>
							<p className={nhItemMessageClass(Boolean(compact))}>
								{notification.message}
							</p>

							{notification.serverActions &&
								notification.serverActions.length > 0 && (
									<div
										className={nhItemServerActionsRowClass(Boolean(compact))}
									>
										{notification.serverActions.map((sa) => {
											const isPrimary =
												sa.action === 'doc_collab_invite_accept';
											const isBusy = busyAction === sa.action;
											return (
												<DesktopAppButton
													key={sa.action}
													type="button"
													disabled={Boolean(busyAction)}
													onClick={(e) => {
														e.stopPropagation();
														void runServerAction(sa.action);
													}}
													variant={isPrimary ? 'accent' : 'ghost'}
													size="sm"
													className={cn(
														nhItemServerActionButtonClass(Boolean(compact)),
														!isPrimary && nhItemSecondaryServerActionClass()
													)}
												>
													{isBusy ? '…' : sa.label}
												</DesktopAppButton>
											);
										})}
									</div>
								)}
							{!notification.serverActions?.length && notification.action && (
								<DesktopAppButton
									onClick={(e) => {
										e.stopPropagation();
										notification.action?.onClick();
									}}
									variant="ghost"
									size="sm"
									className={nhItemLegacyActionButtonClass(Boolean(compact))}
								>
									{notification.action.label} →
								</DesktopAppButton>
							)}

							<div className={nhItemMetaFooterClass(Boolean(compact))}>
								<div className="flex items-center gap-1">
									<ClockIcon
										className={DESKTOP_LUCIDE.xs}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									<span>{timeAgo(notification.timestamp)}</span>
								</div>
								{!notification.read && (
									<DesktopAppStatusBadge className={NH_ITEM_NEW_BADGE_CLASS}>
										{t('newBadge')}
									</DesktopAppStatusBadge>
								)}
							</div>
						</div>
					</div>
				</m.div>
				{ctxMenuPortal}
			</>
		);
	}
);

NotificationHubItem.displayName = 'NotificationHubItem';
