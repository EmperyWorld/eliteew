/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portaled context menu for Quick Search launcher rows (P23 extract).
 *
 * Invariants:
 * - Position via getFloatingMenuPosition; z-index from portal stack bump.
 *
 * Related:
 * - components/QuickSearch.tsx
 * - useQuickSearchModel.ts
 */

import type { TFunction } from 'i18next';
import type * as React from 'react';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_PORTAL_STACK_BUMP,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { isSystemDesktopApp } from '../../utils/desktopAppRegistry';
import {
	getDesktopPortalShellProps,
	getFloatingMenuPosition,
} from '../../utils/desktopUi';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';
import type { DesktopItem, RecentFile } from '../../types/desktop.types';
import {
	BoltIcon,
	DocumentDuplicateIcon,
	MapPinIcon,
	PlayIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { QuickSearchCtxMenu } from './types';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';

export type QuickSearchContextMenuProps = {
	ctxMenu: QuickSearchCtxMenu;
	ctxMenuRef: React.RefObject<HTMLDivElement | null>;
	t: TFunction;
	portalStackBase: number;
	onOpenItem: (item: DesktopItem) => void;
	onClose: () => void;
	onPinAppToDesktop?: (app: DesktopItem) => void;
	onOpenRecentFile?: (file: RecentFile) => void;
	removeRecentFile?: (fileId: string) => void;
	onQuickAction?: (actionId: string) => void;
	closeCtxMenu: () => void;
	copyLauncherText: (text: string) => void | Promise<void>;
};

export function QuickSearchContextMenu({
	ctxMenu,
	ctxMenuRef,
	t,
	portalStackBase,
	onOpenItem,
	onClose,
	onPinAppToDesktop,
	onOpenRecentFile,
	removeRecentFile,
	onQuickAction,
	closeCtxMenu,
	copyLauncherText,
}: QuickSearchContextMenuProps) {
	if (!ctxMenu || typeof document === 'undefined') return null;

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	return (
		<ShellPortalMount>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : ''}
			>
				<div
					ref={ctxMenuRef}
					role="menu"
					aria-label={t('quickSearch.ctxMenuAria')}
					className="fixed text-(--desktop-text-primary)"
					style={{
						...(() => {
							const h =
								ctxMenu.kind === 'app'
									? 220
									: ctxMenu.kind === 'file'
										? 180
										: 56;
							const p = getFloatingMenuPosition(
								{ x: ctxMenu.x, y: ctxMenu.y },
								{
									menuWidth: 228,
									menuHeight: h,
									viewportHeight:
										typeof window !== 'undefined'
											? window.innerHeight
											: undefined,
								}
							);
							return { left: p.x, top: p.y };
						})(),
						zIndex:
							portalStackBase + DESKTOP_PORTAL_STACK_BUMP.QUICK_SEARCH_CTX_MENU,
					}}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<DesktopAppMenuSurface
						className={cn(
							'min-w-[200px] border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] ring-1 ring-(--desktop-border-menu)'
						)}
					>
						{ctxMenu.kind === 'app' ? (
							<>
								<DesktopAppMenuItem
									type="button"
									icon={
										<PlayIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									}
									onClick={() => {
										onOpenItem(ctxMenu.item);
										closeCtxMenu();
										onClose();
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('quickSearch.ctxOpen')}
								</DesktopAppMenuItem>
								{onPinAppToDesktop &&
								ctxMenu.item.type === 'app' &&
								!isSystemDesktopApp(ctxMenu.item) ? (
									<DesktopAppMenuItem
										type="button"
										icon={
											<MapPinIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										}
										onClick={() => {
											onPinAppToDesktop(ctxMenu.item);
											closeCtxMenu();
										}}
										className={DESKTOP_INTERACTIVE.focusRing}
									>
										{t('quickSearch.ctxPin')}
									</DesktopAppMenuItem>
								) : null}
								<DesktopAppMenuDivider />
								<DesktopAppMenuItem
									type="button"
									icon={
										<DocumentDuplicateIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									}
									onClick={() => {
										void copyLauncherText(ctxMenu.item.name);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('quickSearch.ctxCopyName')}
								</DesktopAppMenuItem>
							</>
						) : ctxMenu.kind === 'file' ? (
							<>
								{onOpenRecentFile ? (
									<DesktopAppMenuItem
										type="button"
										icon={
											<PlayIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										}
										onClick={() => {
											onOpenRecentFile(ctxMenu.file);
											closeCtxMenu();
											onClose();
										}}
										className={DESKTOP_INTERACTIVE.focusRing}
									>
										{t('quickSearch.ctxOpen')}
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
										void copyLauncherText(ctxMenu.file.path);
									}}
									className={DESKTOP_INTERACTIVE.focusRing}
								>
									{t('quickSearch.ctxCopyPath')}
								</DesktopAppMenuItem>
								{removeRecentFile && ctxMenu.file.type !== 'project' ? (
									<DesktopAppMenuItem
										type="button"
										tone="danger"
										icon={
											<TrashIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										}
										onClick={() => {
											removeRecentFile(ctxMenu.file.id);
											closeCtxMenu();
										}}
										className={DESKTOP_INTERACTIVE.focusRing}
									>
										{t('quickSearch.ctxRemoveRecent')}
									</DesktopAppMenuItem>
								) : null}
							</>
						) : onQuickAction ? (
							<DesktopAppMenuItem
								type="button"
								icon={
									<BoltIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								}
								onClick={() => {
									onQuickAction(ctxMenu.action.id);
									closeCtxMenu();
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('quickSearch.ctxRun')}
							</DesktopAppMenuItem>
						) : null}
					</DesktopAppMenuSurface>
				</div>
			</div>
		</ShellPortalMount>
	);
}
