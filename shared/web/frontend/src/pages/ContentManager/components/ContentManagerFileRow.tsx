/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * List row for Content Manager files in the compact list view.
 *
 * Invariants:
 * - Row clicks keep preview/select behavior separate from explicit menu actions.
 * - Document editor launches pass unified content ids without mutating the file record.
 *
 * Related:
 * - src/pages/ContentManager/components/ContentManagerActionMenu.tsx
 */
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	formatBytes,
	formatDateShort,
} from '../../../components/UnifiedContent/utils/contentUtils';
import { cn } from '../../../utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { emitDesktopFileOpened } from '../../Desktop/hooks/useRecentFiles';
import {
	requestOpenDocEditorV2WithUnifiedContent,
	requestOpenDocEditorWithUnifiedContent,
	requestPlayAndOpenMusicPlayer,
} from '../../Desktop/utils/desktopDeepLink';
import {
	ContentActionMenu,
	type ContentOpenInHandlers,
} from './ContentManagerActionMenu';
import { TYPE_CONFIG } from './ContentManagerTypeConfig';
import {
	CM_CONTENT_DRAG_MIME,
	type ContentDragPayload,
	setContentManagerDragGhost,
	stringifyContentDragPayload,
} from '../utils/contentManagerDrag';
import { mapContentTypeToRecentType } from '../utils/mapContentTypeToRecentType';
import { isOpenInDocumentType } from '../utils/contentManagerVisibility';
import { canReprocessUnifiedContent } from '../utils/contentManagerReprocess';
import { ContentManagerProcessingFailedAffordance } from './ContentManagerProcessingFailedAffordance';
import {
	ArrowDownTrayIcon,
	CheckIcon,
	EllipsisHorizontalIcon,
	EyeIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	contentManagerDisplayLabel,
	resolvedContentDownloadFileName,
} from '../utils/contentManagerTextLike';

export type ContentManagerFileRowProps = {
	item: ContentItem;
	selected: boolean;
	selectMode: boolean;
	onToggleSelect: (
		id: string,
		opts?: { shiftKey?: boolean; index?: number; fromCheckbox?: boolean }
	) => void;
	/** Flat index in the current file list (list view order) */
	selectionIndex: number;
	onViewFile: (item: ContentItem) => void;
	onDownloadFile: (id: string, name: string) => void | Promise<void>;
	onDeleteFile: (id: string) => void | Promise<void>;
	onEditFile: (item: ContentItem) => void;
	onReprocessDisplay?: (id: string, name: string) => void | Promise<void>;
	onCopyLink?: (id: string) => void | Promise<void>;
	onCopyFile?: (item: ContentItem) => void;
	onMoveFile?: (id: string) => void;
	explorerFolderDnD?: boolean;
	resolveDragContentIds?: (itemId: string) => string[];
	resolveContentDragPayload?: (itemId: string) => ContentDragPayload;
	folderAccentBorderClass?: string;
};

function ContentManagerFileRowInner({
	item,
	selected,
	selectMode,
	onToggleSelect,
	selectionIndex,
	onViewFile,
	onDownloadFile,
	onDeleteFile,
	onEditFile,
	onReprocessDisplay,
	onCopyLink,
	onCopyFile,
	onMoveFile,
	explorerFolderDnD = false,
	resolveDragContentIds,
	resolveContentDragPayload,
	folderAccentBorderClass,
}: ContentManagerFileRowProps) {
	const { t, i18n } = useTranslation('contentManager');
	const lang = i18n.language;
	const config = TYPE_CONFIG[item.content_type] || TYPE_CONFIG.other;
	const canEdit = item.can_edit !== false;
	const canDelete = item.can_delete !== false;
	const displayLabel = useMemo(() => contentManagerDisplayLabel(item), [item]);
	const downloadListFileName = resolvedContentDownloadFileName(item);
	const dragIds =
		explorerFolderDnD && resolveDragContentIds
			? resolveDragContentIds(item.id)
			: [];
	const isDraggable = explorerFolderDnD && dragIds.length > 0;
	const [isDragging, setIsDragging] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);

	const docEditorOpenIn = useMemo((): ContentOpenInHandlers | null => {
		if (!isOpenInDocumentType(item.content_type)) return null;
		return {
			onOpenDocEditor: () => {
				void requestOpenDocEditorWithUnifiedContent(item.id, {
					forceNewWindow: true,
					title: displayLabel,
				});
			},
			onOpenDocEditorV2: () => {
				void requestOpenDocEditorV2WithUnifiedContent(item.id, {
					forceNewWindow: true,
					title: displayLabel,
				});
			},
		};
	}, [item.content_type, item.id, displayLabel]);

	const handleMenuView = useCallback(() => {
		onViewFile(item);
	}, [onViewFile, item]);

	const handleMenuDownload = useCallback(() => {
		void onDownloadFile(item.id, downloadListFileName);
	}, [onDownloadFile, item.id, downloadListFileName]);

	const handleMenuDelete = useCallback(() => {
		void onDeleteFile(item.id);
	}, [onDeleteFile, item.id]);

	const handleMenuProperties = useCallback(() => {
		onEditFile(item);
	}, [onEditFile, item]);

	const handleMenuCopyLink = useCallback(() => {
		void onCopyLink?.(item.id);
	}, [onCopyLink, item.id]);

	const handleMenuCopyFile = useCallback(() => {
		onCopyFile?.(item);
	}, [onCopyFile, item]);

	const handleMenuReprocessDisplay = useCallback(() => {
		if (!onReprocessDisplay || !canReprocessUnifiedContent(item)) {
			return;
		}
		void onReprocessDisplay(item.id, displayLabel);
	}, [displayLabel, item, onReprocessDisplay]);

	const handleMenuPlayInMusicPlayer = useCallback(() => {
		requestPlayAndOpenMusicPlayer({
			id: item.id,
			name: displayLabel,
			thumbnail_url: item.thumbnail_url ?? null,
			mime_type: item.mime_type ?? null,
			version: item.file_hash ?? item.updated_at ?? null,
			source_surface: 'content-manager',
		});
	}, [displayLabel, item]);

	const handleRowClick = useCallback(
		(e: React.MouseEvent) => {
			if (selectMode) {
				onToggleSelect(item.id, {
					shiftKey: e.shiftKey,
					index: selectionIndex,
				});
			} else {
				onViewFile(item);
				emitDesktopFileOpened({
					id: item.id,
					name: displayLabel,
					type: mapContentTypeToRecentType(item.content_type),
					path: `/content/${item.id}`,
				});
			}
		},
		[displayLabel, item, onToggleSelect, onViewFile, selectMode, selectionIndex]
	);

	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setMenuPosition({ x: event.clientX, y: event.clientY });
	}, []);

	return (
		<div className="flex flex-col gap-1">
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: row opens item; trailing buttons are keyboard-accessible */}
			<div
				className={cn(
					'group flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors',
					folderAccentBorderClass && `border-l-4 ${folderAccentBorderClass}`,
					isDraggable
						? isDragging
							? 'cursor-grabbing'
							: 'cursor-grab'
						: 'cursor-pointer',
					selected
						? 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.06)]'
						: 'border-(--desktop-border-subtle) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft)'
				)}
				draggable={isDraggable}
				onDragStart={(e) => {
					if (!isDraggable) return;
					setIsDragging(true);
					const payload: ContentDragPayload = resolveContentDragPayload
						? resolveContentDragPayload(item.id)
						: { ids: dragIds };
					e.dataTransfer.setData(
						CM_CONTENT_DRAG_MIME,
						stringifyContentDragPayload(payload)
					);
					e.dataTransfer.effectAllowed = 'move';
					const el = e.currentTarget as HTMLElement;
					el.style.opacity = '0.42';
					setContentManagerDragGhost(e, {
						title: displayLabel,
						count: dragIds.length,
					});
				}}
				onDragEnd={(e) => {
					setIsDragging(false);
					const el = e.currentTarget as HTMLElement;
					el.style.opacity = '';
				}}
				onClick={handleRowClick}
				onContextMenu={handleContextMenu}
			>
				{selectMode && (
					<div
						className={`flex h-5 w-5 items-center justify-center rounded-md border shrink-0 ${selected ? 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-[rgb(var(--desktop-accent-rgb)/0.85)]' : 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel)'}`}
					>
						{selected && <CheckIcon className="w-3 h-3 text-zinc-950" />}
					</div>
				)}
				<div
					className={`flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) shrink-0 ${config.bg} ${config.color}`}
				>
					{React.isValidElement(config.icon)
						? React.cloneElement(
								config.icon as React.ReactElement<{ className?: string }>,
								{ className: 'w-4 h-4' }
							)
						: config.icon}
				</div>
				<div className="flex-1 min-w-0">
					<span className="text-[13px] font-medium text-(--desktop-text-primary) truncate block">
						{displayLabel}
					</span>
				</div>
				<span className="text-xs text-(--desktop-text-dim) tabular-nums w-20 text-right hidden sm:block">
					{formatBytes(item.file_size ?? 0, lang)}
				</span>
				<span className="text-xs text-(--desktop-text-dim) w-24 text-right hidden md:block tabular-nums">
					{formatDateShort(item.created_at, lang)}
				</span>
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity">
					<DesktopAppButton
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onViewFile(item);
						}}
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						title={t('pro.menu.view')}
						aria-label={t('pro.menu.view')}
					>
						<EyeIcon className="w-3.5 h-3.5 text-(--desktop-text-muted)" />
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							void onDownloadFile(item.id, downloadListFileName);
						}}
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						title={t('pro.menu.download')}
						aria-label={t('pro.menu.download')}
					>
						<ArrowDownTrayIcon className="w-3.5 h-3.5 text-(--desktop-text-muted)" />
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						onMouseDown={(event) => {
							event.preventDefault();
							event.stopPropagation();
						}}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							setMenuPosition({ x: event.clientX, y: event.clientY });
						}}
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						title={t('pro.menu.more')}
						aria-label={t('pro.menu.more')}
					>
						<EllipsisHorizontalIcon className="h-3.5 w-3.5 text-(--desktop-text-muted)" />
					</DesktopAppButton>
					{canDelete && (
						<DesktopAppButton
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								void onDeleteFile(item.id);
							}}
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-red-300/75 hover:border hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-100"
							title={t(
								item.is_owner === false ? 'pro.menu.remove' : 'pro.menu.delete'
							)}
							aria-label={t(
								item.is_owner === false ? 'pro.menu.remove' : 'pro.menu.delete'
							)}
						>
							<TrashIcon className="w-3.5 h-3.5" />
						</DesktopAppButton>
					)}
				</div>
				<ContentActionMenu
					item={item}
					openPosition={menuPosition}
					canEdit={canEdit}
					canDelete={canDelete}
					onClose={() => setMenuPosition(null)}
					onView={handleMenuView}
					onDownload={handleMenuDownload}
					onDelete={handleMenuDelete}
					onOpenProperties={handleMenuProperties}
					openIn={docEditorOpenIn}
					onPlayInMusicPlayer={
						item.content_type === 'audio'
							? handleMenuPlayInMusicPlayer
							: undefined
					}
					onCopyLink={onCopyLink ? handleMenuCopyLink : undefined}
					onCopyFile={onCopyFile ? handleMenuCopyFile : undefined}
					onMove={onMoveFile && canEdit ? () => onMoveFile(item.id) : undefined}
					deleteLabel={t(
						item.is_owner === false ? 'pro.menu.remove' : 'pro.menu.delete'
					)}
					onReprocessDisplay={
						onReprocessDisplay && canReprocessUnifiedContent(item)
							? handleMenuReprocessDisplay
							: undefined
					}
				/>
			</div>
			<ContentManagerProcessingFailedAffordance
				item={item}
				displayLabel={displayLabel}
				onReprocess={onReprocessDisplay}
				layout="row"
				className="mx-1"
			/>
		</div>
	);
}

export const FileRow = React.memo(ContentManagerFileRowInner);
FileRow.displayName = 'FileRow';
