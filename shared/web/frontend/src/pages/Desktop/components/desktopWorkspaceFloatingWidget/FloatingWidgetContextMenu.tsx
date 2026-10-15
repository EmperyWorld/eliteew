/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portaled context menu for the desktop workspace floating widget.
 *
 * Invariants:
 * - Menu uses ShellPortalMount and desktop portal stack bump; closes on outside click / Escape.
 *
 * Related:
 * - DesktopAppChrome.tsx
 * - shell/shellPortal.tsx
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_PORTAL_STACK_BUMP,
} from '../../constants';
import { useDesktopWindowPortalStackBase } from '../../context/DesktopWindowPortalStackContext';
import {
	getDesktopPortalShellProps,
	getFloatingMenuPosition,
} from '../../utils/desktopUi';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';
import {
	BellIcon,
	CheckIcon,
	CpuChipIcon,
	UserIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export interface FloatingWidgetContextMenuProps {
	position: { x: number; y: number } | null;
	onClose: () => void;
	onHide?: () => void;
	onOpenProfile?: () => void;
	onOpenNotificationCenter?: () => void;
	onOpenPerformanceSettings?: () => void;
	markAllAsRead: () => void;
}

export function FloatingWidgetContextMenu({
	position,
	onClose,
	onHide,
	onOpenProfile,
	onOpenNotificationCenter,
	onOpenPerformanceSettings,
	markAllAsRead,
}: FloatingWidgetContextMenuProps) {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'floatingWidgetCtx',
	});
	const portalStackBase = useDesktopWindowPortalStackBase();
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!position) return;
		const onDoc = (ev: MouseEvent) => {
			if (menuRef.current?.contains(ev.target as Node)) return;
			onClose();
		};
		const onKey = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [position, onClose]);

	if (!position || typeof document === 'undefined') return null;

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	return (
		<ShellPortalMount>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : ''}
			>
				<div
					ref={menuRef}
					role="menu"
					aria-label={t('menuAria')}
					className="fixed text-(--desktop-text-primary)"
					style={{
						...(() => {
							const p = getFloatingMenuPosition(
								{ x: position.x, y: position.y },
								{ menuWidth: 260, menuHeight: 280, preferAbove: true }
							);
							return { left: p.x, top: p.y };
						})(),
						zIndex:
							portalStackBase +
							DESKTOP_PORTAL_STACK_BUMP.WORKSPACE_FLOATING_WIDGET_MENU,
					}}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<DesktopAppMenuSurface className="min-w-[220px] ring-1 ring-(--desktop-border-menu)">
						{onHide ? (
							<DesktopAppMenuItem
								type="button"
								icon={
									<XMarkIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									onHide();
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('hide')}
							</DesktopAppMenuItem>
						) : null}
						{onOpenProfile ? (
							<DesktopAppMenuItem
								type="button"
								icon={
									<UserIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									onOpenProfile();
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('profile')}
							</DesktopAppMenuItem>
						) : null}
						{onOpenNotificationCenter ? (
							<DesktopAppMenuItem
								type="button"
								icon={
									<BellIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									onOpenNotificationCenter();
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('notifications')}
							</DesktopAppMenuItem>
						) : null}
						<DesktopAppMenuItem
							type="button"
							icon={
								<CheckIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							}
							onClick={() => {
								markAllAsRead();
								onClose();
							}}
							className={DESKTOP_INTERACTIVE.focusRing}
						>
							{t('markAllRead')}
						</DesktopAppMenuItem>
						{onOpenPerformanceSettings ? (
							<>
								<DesktopAppMenuDivider />
								<DesktopAppMenuItem
									type="button"
									icon={
										<CpuChipIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									}
									onClick={() => {
										onOpenPerformanceSettings();
										onClose();
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('performance')}
								</DesktopAppMenuItem>
							</>
						) : null}
					</DesktopAppMenuSurface>
				</div>
			</div>
		</ShellPortalMount>
	);
}
