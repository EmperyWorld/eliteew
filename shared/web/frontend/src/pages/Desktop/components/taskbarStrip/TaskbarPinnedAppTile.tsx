/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pinned-app tile inside the taskbar «All pinned» modal grid (P24 extract).
 *
 * Invariants:
 * - Preloads app chunk on pointer/focus; open window toggles via onWinClick.
 *
 * Related:
 * - taskbarStrip/TaskbarPinnedMenuIsland.tsx
 * - utils/preloadDesktopApp.ts
 */

import { cn } from '@/utils/cn';
import { memo, type MouseEvent as ReactMouseEvent } from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import type { OpenWindowOptions } from '../../hooks/useWindowManager';
import type { DesktopItem } from '../../types/desktop.types';
import { preloadDesktopApp } from '../../utils/preloadDesktopApp';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import { DESKTOP_APP_STYLE_CONTRACT } from '../DesktopAppChrome';
import { TaskbarCountBadge } from '../TaskbarCountBadge';
import { isFriendsAppBadge, isGafChatAppBadge } from './taskbarStripHelpers';

export type TaskbarPinnedAppTileProps = {
	app: DesktopItem;
	badge: number;
	iconStyle: DesktopIconStyle;
	isOpen: boolean;
	openWindowId: string | undefined;
	openBadgeLabel: string;
	onWinClick: (id: string) => void;
	onOpenApp: (app: DesktopItem, options?: OpenWindowOptions) => void;
	onClose: () => void;
	onContextMenu: (e: ReactMouseEvent, app: DesktopItem) => void;
};

export const TaskbarPinnedAppTile = memo(function TaskbarPinnedAppTile({
	app,
	badge,
	iconStyle,
	isOpen,
	openWindowId,
	openBadgeLabel,
	onWinClick,
	onOpenApp,
	onClose,
	onContextMenu,
}: TaskbarPinnedAppTileProps) {
	const friendsBadge = isFriendsAppBadge(app.appComponent);
	const gafChatBadge = isGafChatAppBadge(app.appComponent);

	return (
		<button
			type="button"
			onPointerEnter={() => {
				void preloadDesktopApp(app.appComponent);
			}}
			onFocus={() => {
				void preloadDesktopApp(app.appComponent);
			}}
			onClick={() => {
				if (openWindowId) {
					onWinClick(openWindowId);
				} else {
					onOpenApp(app);
				}
				onClose();
			}}
			onContextMenu={(e) => onContextMenu(e, app)}
			onMouseDown={(e) => {
				if (e.button !== 2) return;
				onContextMenu(e, app);
			}}
			className={cn(
				'relative flex flex-col items-center gap-2 p-3 rounded-2xl group',
				'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none',
				'motion-safe:fine-hover:-translate-y-0.5 motion-safe:active:translate-y-0',
				DESKTOP_APP_STYLE_CONTRACT.softCard,
				'border-[color-mix(in_srgb,var(--desktop-text-primary)_9%,transparent)] bg-[rgb(var(--desktop-bg-secondary-rgb))] fine-hover:border-[rgb(var(--desktop-accent-rgb)/0.34)] fine-hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,rgb(var(--desktop-bg-secondary-rgb)))]',
				DESKTOP_INTERACTIVE.focusRing
			)}
			aria-label={app.name}
		>
			<div className="relative h-11 w-11 sm:h-12 sm:w-12">
				<DesktopAppBadge
					appComponent={app.appComponent}
					icon={app.icon}
					variant="start"
					className="h-11 w-11 sm:h-12 sm:w-12"
					iconStyle={iconStyle}
				/>
				<TaskbarCountBadge
					count={badge}
					variant={friendsBadge ? 'friends' : gafChatBadge ? 'chat' : 'default'}
					positionClassName="-top-1.5 -right-1.5"
				/>
			</div>
			<span
				className={cn(
					DESKTOP_TYPOGRAPHY.widgetTrackTitle,
					'w-full text-center'
				)}
			>
				{app.name}
			</span>
			<span
				className={cn(
					DESKTOP_TYPOGRAPHY.small,
					'w-full text-center',
					isOpen
						? 'font-medium text-[rgb(var(--desktop-accent-rgb))]'
						: 'text-(--desktop-text-muted)'
				)}
			>
				{isOpen ? openBadgeLabel : '\u00a0'}
			</span>
		</button>
	);
});
