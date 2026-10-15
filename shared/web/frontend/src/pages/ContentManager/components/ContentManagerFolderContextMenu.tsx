/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context menu for Content Manager desktop folders (tree + nested panel rows).
 *
 * Invariants:
 * - System folders: open/new-child/refresh only; rename/delete disabled.
 * - Mutations call desktop items API via parent callbacks.
 *
 * Related:
 * - ContentManagerFilesTab.tsx · Desktop/services/desktopApi.ts
 * - documentation/product/CONTENT-MANAGER-EXPLORER-PARITY-AUDIT-2026-07-11.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { useDesktopWindowPortalStackBase } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { getDesktopPortalShellProps } from '../../Desktop/utils/desktopUi';

export type ContentManagerFolderMenuTarget = {
	item_id: string;
	name: string;
	is_system?: boolean | null;
};

export type ContentManagerFolderContextMenuProps = {
	target: ContentManagerFolderMenuTarget | null;
	openPosition: { x: number; y: number } | null;
	onClose: () => void;
	onOpen: (itemId: string) => void;
	onNewFolder: (parentItemId: string) => void;
	onRename: (itemId: string, currentName: string) => void;
	onDelete: (itemId: string, name: string) => void;
	onRefresh: () => void;
};

export function ContentManagerFolderContextMenu({
	target,
	openPosition,
	onClose,
	onOpen,
	onNewFolder,
	onRename,
	onDelete,
	onRefresh,
}: ContentManagerFolderContextMenuProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [resolvedPosition, setResolvedPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);

	useLayoutEffect(() => {
		if (!openPosition || typeof window === 'undefined') {
			setResolvedPosition(null);
			return;
		}
		const pad = 8;
		const w = 220;
		const h = 220;
		let x = openPosition.x;
		let y = openPosition.y;
		if (x + w > window.innerWidth - pad)
			x = Math.max(pad, window.innerWidth - w - pad);
		if (y + h > window.innerHeight - pad)
			y = Math.max(pad, window.innerHeight - h - pad);
		setResolvedPosition({ x, y });
	}, [openPosition]);

	useEffect(() => {
		if (!openPosition) return;
		const onDoc = (e: MouseEvent) => {
			if (menuRef.current?.contains(e.target as Node)) return;
			onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [openPosition, onClose]);

	const run = useCallback(
		(fn: () => void) => {
			onClose();
			fn();
		},
		[onClose]
	);

	if (
		!target ||
		!openPosition ||
		!resolvedPosition ||
		typeof document === 'undefined'
	) {
		return null;
	}

	const isSystem = target.is_system === true;
	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	return createPortal(
		<div
			style={portalShellStyle}
			className={portalTheme === 'dark' ? 'dark' : ''}
		>
			<AnimatePresence>
				<motion.div
					initial={{ opacity: 0, scale: 0.98, y: 6 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.98, y: 6 }}
					transition={{ duration: 0.14, ease: 'easeOut' }}
					className="fixed text-(--desktop-text-primary)"
					style={{
						left: `${resolvedPosition.x}px`,
						top: `${resolvedPosition.y}px`,
						zIndex: portalStackBase,
					}}
				>
					<div ref={menuRef} className="overflow-visible">
						<DesktopAppMenuSurface
							className="min-w-[196px] overflow-visible ring-1 ring-(--desktop-border-menu)"
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
						>
							<DesktopAppMenuItem
								type="button"
								onClick={() => run(() => onOpen(target.item_id))}
								icon={
									<FolderIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
								}
								className="text-xs"
							>
								{t('explorer.folderMenu.open')}
							</DesktopAppMenuItem>
							<DesktopAppMenuItem
								type="button"
								onClick={() => run(() => onNewFolder(target.item_id))}
								icon={
									<FolderPlusIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
								}
								className="text-xs"
							>
								{t('explorer.folderMenu.newFolder')}
							</DesktopAppMenuItem>
							{!isSystem ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() =>
										run(() => onRename(target.item_id, target.name))
									}
									icon={
										<PencilSquareIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('explorer.folderMenu.rename')}
								</DesktopAppMenuItem>
							) : null}
							<DesktopAppMenuDivider />
							<DesktopAppMenuItem
								type="button"
								onClick={() => run(() => onRefresh())}
								icon={
									<ArrowPathIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
								}
								className="text-xs"
							>
								{t('explorer.folderMenu.refresh')}
							</DesktopAppMenuItem>
							{!isSystem ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() =>
										run(() => onDelete(target.item_id, target.name))
									}
									icon={
										<TrashIcon className="h-4 w-4 shrink-0 text-red-300/80" />
									}
									className="text-xs text-red-200/90"
								>
									{t('explorer.folderMenu.delete')}
								</DesktopAppMenuItem>
							) : null}
						</DesktopAppMenuSurface>
					</div>
				</motion.div>
			</AnimatePresence>
		</div>,
		document.body
	);
}
