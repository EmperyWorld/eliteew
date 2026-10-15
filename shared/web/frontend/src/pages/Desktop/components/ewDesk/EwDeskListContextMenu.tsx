/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk list-row context menu (open, read/unread, star, copy link/id).
 *
 * Invariants:
 * - Menu closes via parent click/Escape handlers; this component only renders surface.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 */
import { DESKTOP_INTERACTIVE } from '../../constants';
import type { CompanyNewsPostListItem } from '../../services/productDesktopApi';
import { getFloatingMenuPosition } from '../../utils/desktopUi';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../DesktopAppChrome';
import { AnimatePresence, m } from 'framer-motion';
import type { TFunction } from 'i18next';
import { useMemo, type ReactElement } from 'react';

export interface EwDeskListContextMenuProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	menu: { x: number; y: number; postId: string } | null;
	portalStackBase: number;
	filteredPosts: CompanyNewsPostListItem[];
	readIds: Set<string>;
	starredIds: Set<string>;
	onClose: () => void;
	onSelectPost: (id: string) => void;
	onMarkRead: (id: string) => void;
	onMarkUnread: (id: string) => void;
	onToggleStar: (id: string) => void;
	onCopyLink: (id: string) => Promise<void>;
	onCopyId: (id: string) => Promise<void>;
}

export function EwDeskListContextMenu({
	t,
	menu,
	portalStackBase,
	filteredPosts,
	readIds,
	starredIds,
	onClose,
	onSelectPost,
	onMarkRead,
	onMarkUnread,
	onToggleStar,
	onCopyLink,
	onCopyId,
}: EwDeskListContextMenuProps): ReactElement {
	const post = useMemo(() => {
		if (!menu) return undefined;
		return filteredPosts.find((p) => p.id === menu.postId);
	}, [menu, filteredPosts]);

	const pos = useMemo(() => {
		if (!menu) return null;
		return getFloatingMenuPosition(
			{ x: menu.x, y: menu.y },
			{ menuWidth: 220, menuHeight: 168 }
		);
	}, [menu]);

	return (
		<AnimatePresence>
			{menu && post && pos ? (
				<m.div
					key="ewdesk-list-context"
					initial={{ opacity: 0, scale: 0.96, y: 4 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.96, y: 4 }}
					transition={{ duration: 0.12 }}
					className="fixed"
					style={{
						zIndex: portalStackBase,
						left: pos.x,
						top: pos.y,
					}}
					role="presentation"
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<DesktopAppMenuSurface
						className="min-w-[200px]"
						role="menu"
						aria-label={t('listContextMenuAria')}
					>
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								onSelectPost(post.id);
								onClose();
							}}
							className={DESKTOP_INTERACTIVE.focusRing}
						>
							{t('listContextOpen')}
						</DesktopAppMenuItem>
						<DesktopAppMenuDivider />
						{readIds.has(post.id) ? (
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									onMarkUnread(post.id);
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('listContextMarkUnread')}
							</DesktopAppMenuItem>
						) : (
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									onMarkRead(post.id);
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('listContextMarkRead')}
							</DesktopAppMenuItem>
						)}
						{starredIds.has(post.id) ? (
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									onToggleStar(post.id);
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('listContextStarRemove')}
							</DesktopAppMenuItem>
						) : (
							<DesktopAppMenuItem
								type="button"
								role="menuitem"
								onClick={() => {
									onToggleStar(post.id);
									onClose();
								}}
								className={DESKTOP_INTERACTIVE.focusRing}
							>
								{t('listContextStarAdd')}
							</DesktopAppMenuItem>
						)}
						<DesktopAppMenuDivider />
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								void onCopyLink(post.id);
								onClose();
							}}
							className={DESKTOP_INTERACTIVE.focusRing}
						>
							{t('listContextCopyLink')}
						</DesktopAppMenuItem>
						<DesktopAppMenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								void onCopyId(post.id);
								onClose();
							}}
							className={DESKTOP_INTERACTIVE.focusRing}
						>
							{t('listContextCopyId')}
						</DesktopAppMenuItem>
					</DesktopAppMenuSurface>
				</m.div>
			) : null}
		</AnimatePresence>
	);
}
