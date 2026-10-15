/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context menu for Content Manager file actions, including preview, editor handoff, download,
 * properties, processing, link copy, and delete actions.
 *
 * Invariants:
 * - Menu actions must close the floating portal before launching cross-app desktop handlers.
 * - V1 and V2 document editor entries stay separate so legacy fallback remains explicit.
 *
 * Related:
 * - src/pages/ContentManager/components/ContentManagerFileCard.tsx
 * - src/pages/ContentManager/components/ContentManagerFileRow.tsx
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
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { emitDesktopFileOpened } from '../../Desktop/hooks/useRecentFiles';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { useDesktopWindowPortalStackBase } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { getDesktopPortalShellProps } from '../../Desktop/utils/desktopUi';
import { mapContentTypeToRecentType } from '../utils/mapContentTypeToRecentType';
import { reprocessMenuLabelKey } from '../utils/contentManagerReprocess';
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	EyeIcon,
	DocumentDuplicateIcon,
	FolderIcon,
	LinkIcon,
	MusicalNoteIcon,
	PencilSquareIcon,
	TrashIcon,
	WrenchIcon,
} from '@heroicons/react/24/outline';

export interface ContentOpenInHandlers {
	onOpenDocEditor: () => void;
	onOpenDocEditorV2?: () => void;
}

export interface ContentActionMenuProps {
	item: ContentItem;
	openPosition: { x: number; y: number } | null;
	canEdit: boolean;
	canDelete: boolean;
	onClose: () => void;
	onView: () => void;
	onDownload: () => void;
	onDelete: () => void;
	onOpenProperties: () => void;
	openIn?: ContentOpenInHandlers | null;
	/** Audio → global Music Player (exclusive transport), not a second local stream. */
	onPlayInMusicPlayer?: () => void;
	onCopyLink?: () => void;
	onCopyFile?: () => void;
	onMove?: () => void;
	deleteLabel?: string;
	/** Re-run file processing (extracted text / preview); owner-only, wired from parent. */
	onReprocessDisplay?: () => void;
}

export const ContentActionMenu: React.FC<ContentActionMenuProps> = ({
	item,
	openPosition,
	canEdit,
	canDelete,
	onClose,
	onView,
	onDownload,
	onDelete,
	onOpenProperties,
	openIn,
	onPlayInMusicPlayer,
	onCopyLink,
	onCopyFile,
	onMove,
	deleteLabel,
	onReprocessDisplay,
}) => {
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

		const updatePosition = (): void => {
			const menuWidth = menuRef.current?.offsetWidth ?? 196;
			const menuHeight = menuRef.current?.offsetHeight ?? 280;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const margin = 12;
			const cursorGap = 4;
			const flipGap = 8;

			const preferredX = openPosition.x + cursorGap;
			const preferredY = openPosition.y + cursorGap;

			let nextX = preferredX;
			if (preferredX + menuWidth > viewportWidth - margin) {
				const flippedX = openPosition.x - menuWidth - flipGap;
				nextX =
					flippedX >= margin ? flippedX : viewportWidth - menuWidth - margin;
			}

			let nextY = preferredY;
			if (preferredY + menuHeight > viewportHeight - margin) {
				const flippedY = openPosition.y - menuHeight - flipGap;
				nextY =
					flippedY >= margin ? flippedY : viewportHeight - menuHeight - margin;
			}

			const clampedX = Math.max(
				margin,
				Math.min(nextX, viewportWidth - menuWidth - margin)
			);
			const clampedY = Math.max(
				margin,
				Math.min(nextY, viewportHeight - menuHeight - margin)
			);

			setResolvedPosition((previous) =>
				previous?.x === clampedX && previous?.y === clampedY
					? previous
					: { x: clampedX, y: clampedY }
			);
		};

		const frame = window.requestAnimationFrame(updatePosition);
		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', updatePosition, true);

		return (): void => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', updatePosition, true);
		};
	}, [openPosition]);

	useEffect(() => {
		if (!openPosition || typeof window === 'undefined') {
			return;
		}

		const handlePointerDown = (event: MouseEvent): void => {
			const target = event.target;
			if (target instanceof Node && menuRef.current?.contains(target)) {
				return;
			}
			onClose();
		};

		const handleEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('mousedown', handlePointerDown, true);
		window.addEventListener('contextmenu', handlePointerDown, true);
		window.addEventListener('keydown', handleEscape);

		return (): void => {
			window.removeEventListener('mousedown', handlePointerDown, true);
			window.removeEventListener('contextmenu', handlePointerDown, true);
			window.removeEventListener('keydown', handleEscape);
		};
	}, [openPosition, onClose]);

	const openContent = useCallback(() => {
		onClose();
		onView();
		emitDesktopFileOpened({
			id: item.id,
			name: item.name,
			type: mapContentTypeToRecentType(item.content_type),
			path: `/content/${item.id}`,
		});
	}, [item, onClose, onView]);

	const runAction = useCallback(
		(action: () => void) => {
			onClose();
			action();
		},
		[onClose]
	);

	if (!openPosition || !resolvedPosition || typeof document === 'undefined') {
		return null;
	}

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
							className="min-w-49 overflow-visible ring-1 ring-(--desktop-border-menu)"
							onMouseDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
							}}
						>
							<DesktopAppMenuItem
								type="button"
								onClick={openContent}
								icon={
									<EyeIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
								}
								className="text-xs"
							>
								{t('pro.menu.view')}
							</DesktopAppMenuItem>
							{onPlayInMusicPlayer && item.content_type === 'audio' ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onPlayInMusicPlayer)}
									icon={
										<MusicalNoteIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('pro.menu.openInMusicPlayer')}
								</DesktopAppMenuItem>
							) : null}
							{openIn ? (
								<>
									<DesktopAppMenuItem
										type="button"
										onClick={() => runAction(openIn.onOpenDocEditor)}
										icon={
											<DocumentTextIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
										}
										className="text-xs"
									>
										{t('pro.menu.openInDocEditor')}
									</DesktopAppMenuItem>
									{openIn.onOpenDocEditorV2 ? (
										<DesktopAppMenuItem
											type="button"
											onClick={() =>
												runAction(() => openIn.onOpenDocEditorV2?.())
											}
											icon={
												<DocumentTextIcon className="h-4 w-4 shrink-0 text-amber-200" />
											}
											className="text-xs"
										>
											{t('pro.menu.openInDocEditorV2')}
										</DesktopAppMenuItem>
									) : null}
								</>
							) : null}
							{canEdit ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onOpenProperties)}
									icon={
										<PencilSquareIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('pro.menu.properties', {
										defaultValue: t('pro.menu.edit'),
									})}
								</DesktopAppMenuItem>
							) : null}
							{canEdit && onReprocessDisplay ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onReprocessDisplay)}
									icon={
										<WrenchIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t(reprocessMenuLabelKey(item))}
								</DesktopAppMenuItem>
							) : null}
							<DesktopAppMenuItem
								type="button"
								onClick={() => runAction(onDownload)}
								icon={
									<ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
								}
								className="text-xs"
							>
								{item.content_type === 'image'
									? t('pro.menu.downloadOriginal')
									: t('pro.menu.download')}
							</DesktopAppMenuItem>
							{onCopyFile ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onCopyFile)}
									icon={
										<DocumentDuplicateIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('pro.menu.copyFile')}
								</DesktopAppMenuItem>
							) : null}
							{onCopyLink ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onCopyLink)}
									icon={
										<LinkIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('pro.menu.copyLink')}
								</DesktopAppMenuItem>
							) : null}
							{onMove ? (
								<DesktopAppMenuItem
									type="button"
									onClick={() => runAction(onMove)}
									icon={
										<FolderIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
									}
									className="text-xs"
								>
									{t('pro.menu.move')}
								</DesktopAppMenuItem>
							) : null}
							{canDelete ? (
								<>
									<DesktopAppMenuDivider />
									<DesktopAppMenuItem
										type="button"
										onClick={() => runAction(onDelete)}
										tone="danger"
										icon={<TrashIcon className="h-4 w-4 shrink-0" />}
										className="text-xs"
									>
										{deleteLabel ?? t('pro.menu.delete')}
									</DesktopAppMenuItem>
								</>
							) : null}
						</DesktopAppMenuSurface>
					</div>
				</motion.div>
			</AnimatePresence>
		</div>,
		document.body
	);
};
