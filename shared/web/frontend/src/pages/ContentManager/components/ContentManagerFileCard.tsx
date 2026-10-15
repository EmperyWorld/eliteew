/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grid card for Content Manager files with inline preview, selection, DnD, and contextual actions.
 *
 * Invariants:
 * - Card click behavior remains preview/select first; editor opens stay explicit menu actions.
 * - Clicks/keys on inline media (`audio`/`video`/`img`) must not toggle or close the inline preview.
 * - Document editor launches pass unified content ids without mutating the file record.
 *
 * Related:
 * - src/pages/ContentManager/components/ContentManagerActionMenu.tsx
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentThumbnail } from '../../../components/UnifiedContent/components/ContentThumbnail';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	formatBytes,
	formatDateShort,
	resolveIntlDateLocale,
} from '../../../components/UnifiedContent/utils/contentUtils';
import { cn } from '../../../utils/cn';
import {
	DesktopAppButton,
	DesktopAppStatusBadge,
} from '../../Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../Desktop/context/DesktopShellFrameContext';
import { emitDesktopFileOpened } from '../../Desktop/hooks/useRecentFiles';
import { DESKTOP_OVERLAY } from '../../Desktop/constants';
import {
	getDesktopShellFileCardMetaClassName,
	getDesktopShellFileCardRootIdleClassName,
	getDesktopShellFileCardThumbClassName,
} from '../../Desktop/utils/desktopVisualSystem';
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
import {
	canInlinePreview,
	getDisplayVisibility,
	isOpenInDocumentType,
} from '../utils/contentManagerVisibility';
import { canReprocessUnifiedContent } from '../utils/contentManagerReprocess';
import { ContentManagerProcessingFailedAffordance } from './ContentManagerProcessingFailedAffordance';
import {
	ArrowPathIcon,
	CheckIcon,
	EllipsisHorizontalIcon,
	EyeIcon,
	MusicalNoteIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	contentManagerDisplayLabel,
	resolvedContentDownloadFileName,
} from '../utils/contentManagerTextLike';

/** Marks the inline media region so card click/keyboard handlers ignore transport interaction. */
function InlineMediaSurface({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}): React.ReactElement {
	return (
		<div
			data-cm-inline-media=""
			className={className}
			onPointerDown={(e) => e.stopPropagation()}
		>
			{children}
		</div>
	);
}

export type ContentManagerFileCardProps = {
	item: ContentItem;
	filterVisibility: 'all' | 'private' | 'shared' | 'friends' | 'from_friends';
	selected: boolean;
	selectMode: boolean;
	onToggleSelect: (
		id: string,
		opts?: { shiftKey?: boolean; index?: number; fromCheckbox?: boolean }
	) => void;
	/** Flat index on the current page (grid order) — for Shift+range selection */
	selectionIndex: number;
	onViewFile: (item: ContentItem) => void;
	onDownloadFile: (id: string, name: string) => void | Promise<void>;
	onDeleteFile: (id: string) => void | Promise<void>;
	onEditFile: (item: ContentItem) => void;
	/** Re-run backend processing for document-like files (owner). */
	onReprocessDisplay?: (id: string, name: string) => void | Promise<void>;
	onCopyLink?: (id: string) => void | Promise<void>;
	onCopyFile?: (item: ContentItem) => void;
	onMoveFile?: (id: string) => void;
	inlinePreviewBlobUrl: string | null;
	inlinePreviewLoading: boolean;
	onToggleInlinePreview: (id: string) => void;
	explorerFolderDnD?: boolean;
	resolveDragContentIds?: (itemId: string) => string[];
	resolveContentDragPayload?: (itemId: string) => ContentDragPayload;
	/** Roving tabindex for grid keyboard navigation (-1 = skip tab order). */
	rovingTabIndex?: number;
	/** Arrow / Home / End navigation in virtualized or dense grids */
	onGridArrowNavigate?: (key: string, itemId: string) => void;
	/** В окне рабочего стола — карточки под пресетом «стиль окон». */
	embedded?: boolean;
	/** Левая цветная полоса по папке (режим «Все файлы» / группировка по папке). */
	folderAccentBorderClass?: string;
};

function ContentManagerFileCardInner({
	item,
	filterVisibility,
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
	inlinePreviewBlobUrl,
	inlinePreviewLoading,
	onToggleInlinePreview,
	explorerFolderDnD = false,
	resolveDragContentIds,
	resolveContentDragPayload,
	rovingTabIndex = 0,
	onGridArrowNavigate,
	embedded = false,
	folderAccentBorderClass,
}: ContentManagerFileCardProps) {
	const shellFrame = useDesktopShellFrame();
	const { t, i18n } = useTranslation('contentManager');
	const lang = i18n.language;
	const typeLabel = t(`contentTypes.${item.content_type}`, {
		defaultValue: t('files.typeOtherGroup'),
	});
	const visibilityLabel = useCallback(
		(v: string) => {
			switch (v) {
				case 'private':
					return t('files.filters.visibilityPrivate');
				case 'friends':
					return t('files.filters.visibilityFriends');
				case 'from_friends':
					return t('files.filters.visibilityFromFriends');
				case 'shared':
					return t('files.filters.visibilityShared');
				case 'public':
					return t('pro.visibility.public');
				default:
					return t('files.filters.visibilityPrivate');
			}
		},
		[t]
	);
	const formatDateRelativeLocal = useCallback(
		(dateString: string) => {
			const date = new Date(dateString);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffDays = Math.floor(diffMs / 86400000);
			const loc = resolveIntlDateLocale(lang);
			if (diffDays === 0) return t('pro.relative.today');
			if (diffDays === 1) return t('pro.relative.yesterday');
			if (diffDays >= 2 && diffDays < 7)
				return t('pro.relative.daysAgo', { n: diffDays });
			if (diffDays < 30)
				return date.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
			return date.toLocaleDateString(loc, { month: 'short', year: '2-digit' });
		},
		[t, lang]
	);
	const formatDateFullLocal = useCallback(
		(ds: string) =>
			new Date(ds).toLocaleString(resolveIntlDateLocale(lang), {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}),
		[lang]
	);
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
	const [showTooltip, setShowTooltip] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const menuJustOpenedRef = useRef(false);
	const config = TYPE_CONFIG[item.content_type] || TYPE_CONFIG.other;
	const isInlineOpen = !!inlinePreviewBlobUrl;
	const supportsInline = canInlinePreview(item.content_type);
	const inlineAudioAriaLabel =
		displayLabel.trim() ||
		item.original_filename?.trim() ||
		item.file_path?.split('/').pop()?.trim() ||
		typeLabel;

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
	}, [displayLabel, item.content_type, item.id]);

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

	const handleCardClick = useCallback(
		(e: React.MouseEvent | React.KeyboardEvent): void => {
			if (menuJustOpenedRef.current) {
				menuJustOpenedRef.current = false;
				return;
			}
			const eventTarget = e.target;
			if (
				eventTarget instanceof Element &&
				eventTarget.closest('[data-cm-inline-media],audio,video')
			) {
				// Native media transport clicks bubble to the card; must not toggle preview.
				return;
			}
			if (selectMode) {
				onToggleSelect(item.id, {
					shiftKey: e.shiftKey,
					index: selectionIndex,
				});
			} else if (supportsInline) {
				onToggleInlinePreview(item.id);
				if (!isInlineOpen) {
					emitDesktopFileOpened({
						id: item.id,
						name: displayLabel,
						type: mapContentTypeToRecentType(item.content_type),
						path: `/content/${item.id}`,
					});
				}
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
		[
			displayLabel,
			item,
			isInlineOpen,
			onToggleSelect,
			onViewFile,
			onToggleInlinePreview,
			selectMode,
			selectionIndex,
			supportsInline,
		]
	);

	const handleCardKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>): void => {
			const tEl = e.target as HTMLElement | null;
			if (
				tEl &&
				tEl !== e.currentTarget &&
				tEl.closest(
					'button,a,input,textarea,select,audio,video,[data-cm-inline-media]'
				)
			) {
				return;
			}
			if (
				e.key === 'ArrowLeft' ||
				e.key === 'ArrowRight' ||
				e.key === 'ArrowUp' ||
				e.key === 'ArrowDown' ||
				e.key === 'Home' ||
				e.key === 'End'
			) {
				if (onGridArrowNavigate) {
					e.preventDefault();
					onGridArrowNavigate(e.key, item.id);
				}
				return;
			}
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleCardClick(e);
			}
		},
		[handleCardClick, item.id, onGridArrowNavigate]
	);

	const handleMenuButtonClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		menuJustOpenedRef.current = true;
		setMenuPosition((previous) =>
			previous ? null : { x: e.clientX, y: e.clientY }
		);
		setTimeout(() => {
			menuJustOpenedRef.current = false;
		}, 300);
	}, []);

	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setShowTooltip(false);
		setMenuPosition({ x: event.clientX, y: event.clientY });
	}, []);

	return (
		// biome-ignore lint/a11y/useSemanticElements: карточка файла с DnD/роутингом фокуса, не группа полей формы
		<div
			data-cm-file-id={item.id}
			tabIndex={rovingTabIndex}
			role="group"
			aria-label={displayLabel}
			onKeyDown={handleCardKeyDown}
			className={cn(
				'group relative overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
				folderAccentBorderClass && `border-l-4 ${folderAccentBorderClass}`,
				isDraggable
					? isDragging
						? 'cursor-grabbing'
						: 'cursor-grab'
					: 'cursor-pointer',
				selected
					? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] shadow-(--desktop-shadow-soft) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
					: embedded
						? getDesktopShellFileCardRootIdleClassName(shellFrame)
						: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong) hover:shadow-(--desktop-shadow-soft)'
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
			onClick={handleCardClick}
			onMouseEnter={() => setShowTooltip(true)}
			onMouseLeave={() => {
				setShowTooltip(false);
			}}
			onContextMenu={handleContextMenu}
		>
			{/* Превью: как в Image Studio — по «Просмотр» контент показывается прямо здесь, по «Скрыть» сворачивается */}
			<div className="relative">
				<div
					className={cn(
						// Превью и мета визуально сбалансированы: без лишней высоты мета-блока превью не «тонет».
						'relative flex aspect-4/3 min-h-24 max-h-33 shrink-0 items-center justify-center overflow-hidden sm:min-h-25 sm:max-h-35.5',
						embedded
							? getDesktopShellFileCardThumbClassName(shellFrame)
							: 'border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)'
					)}
				>
					{inlinePreviewLoading ? (
						<div
							className={cn(
								'absolute inset-0 flex items-center justify-center',
								DESKTOP_OVERLAY.backdrop
							)}
						>
							<ArrowPathIcon
								className="w-6 h-6 animate-spin text-(--desktop-text-muted)"
								aria-hidden
							/>
						</div>
					) : isInlineOpen && inlinePreviewBlobUrl ? (
						<>
							{item.content_type === 'image' && (
								<InlineMediaSurface className="absolute inset-0">
									<img
										src={inlinePreviewBlobUrl}
										alt=""
										className="absolute inset-0 h-full w-full object-contain"
									/>
								</InlineMediaSurface>
							)}
							{item.content_type === 'video' && (
								<InlineMediaSurface className="absolute inset-0">
									<video
										src={inlinePreviewBlobUrl}
										controls
										className="absolute inset-0 h-full w-full object-contain"
									>
										<track kind="captions" srcLang="en" label="Captions" />
									</video>
								</InlineMediaSurface>
							)}
							{item.content_type === 'audio' && (
								<InlineMediaSurface className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-(--desktop-surface-panel-strong) p-1.5">
									<MusicalNoteIcon className="w-8 h-8 text-(--desktop-text-muted) shrink-0" />
									<audio
										src={inlinePreviewBlobUrl}
										controls
										className="w-full max-w-full"
										aria-label={inlineAudioAriaLabel}
										title={inlineAudioAriaLabel}
									>
										<track kind="captions" srcLang="en" label="Captions" />
									</audio>
								</InlineMediaSurface>
							)}
						</>
					) : item.thumbnail_url ? (
						<ContentThumbnail
							contentId={item.id}
							alt=""
							className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
						>
							<div
								className={`flex h-11 w-11 items-center justify-center rounded-lg border border-(--desktop-border-strong) shadow-inner sm:h-12 sm:w-12 ${config.bg} ${config.color}`}
							>
								{config.icon}
							</div>
						</ContentThumbnail>
					) : (
						<div
							className={`flex h-11 w-11 items-center justify-center rounded-lg border border-(--desktop-border-strong) shadow-inner sm:h-12 sm:w-12 ${config.bg} ${config.color}`}
						>
							{config.icon}
						</div>
					)}
					{/* Бейдж типа — аккуратная оконтовка */}
					<DesktopAppStatusBadge
						className={cn(
							'absolute top-1.5 left-1.5 gap-1 px-1.5 py-0.5 text-[9px] font-medium tracking-wide',
							config.bg,
							config.color
						)}
					>
						{React.isValidElement(config.icon)
							? React.cloneElement(
									config.icon as React.ReactElement<{ className?: string }>,
									{
										className: 'w-3.5 h-3.5 shrink-0',
									}
								)
							: config.icon}
						{typeLabel}
					</DesktopAppStatusBadge>
					{selectMode &&
						(selected ? (
							<button
								type="button"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onToggleSelect(item.id, {
										fromCheckbox: true,
										index: selectionIndex,
									});
								}}
								className="absolute top-1.5 right-9 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md shrink-0 bg-[rgb(var(--desktop-accent-rgb)/0.85)]"
								aria-label={t('pro.grid.deselect')}
								aria-pressed="true"
							>
								<CheckIcon className="w-3.5 h-3.5 text-white" />
							</button>
						) : (
							<button
								type="button"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onToggleSelect(item.id, {
										fromCheckbox: true,
										index: selectionIndex,
									});
								}}
								className="absolute top-1.5 right-9 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md shrink-0 border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)"
								aria-label={t('pro.grid.select')}
								aria-pressed="false"
							/>
						))}
					{/* Как в Image Studio: что делает кнопка — показывает контент прямо в карточке; «Скрыть» сворачивает */}
					{canDelete ? (
						<DesktopAppButton
							type="button"
							onMouseDown={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								void onDeleteFile(item.id);
							}}
							variant="ghost"
							size="icon"
							className="absolute top-1.5 right-10 z-10 h-7 w-7 text-red-300/75 opacity-0 transition-opacity group-hover:opacity-100 hover:border hover:border-red-400/25 hover:bg-red-500/10 hover:text-red-100"
							title={t(
								item.is_owner === false ? 'pro.menu.remove' : 'pro.menu.delete'
							)}
							aria-label={t(
								item.is_owner === false ? 'pro.menu.remove' : 'pro.menu.delete'
							)}
						>
							<TrashIcon className="h-4 w-4" />
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						type="button"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							if (supportsInline) {
								onToggleInlinePreview(item.id);
								if (!isInlineOpen) {
									emitDesktopFileOpened({
										id: item.id,
										name: displayLabel,
										type: mapContentTypeToRecentType(item.content_type),
										path: `/content/${item.id}`,
									});
								}
							} else {
								onViewFile(item);
								emitDesktopFileOpened({
									id: item.id,
									name: displayLabel,
									type: mapContentTypeToRecentType(item.content_type),
									path: `/content/${item.id}`,
								});
							}
						}}
						variant="ghost"
						size="sm"
						className={cn(
							'absolute bottom-1.5 right-1.5 z-10 border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/90 text-[10px] font-medium text-(--desktop-text-secondary) shadow-sm backdrop-blur-sm transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
							isInlineOpen &&
								'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
						)}
						title={isInlineOpen ? t('pro.grid.hide') : t('pro.grid.view')}
						aria-label={isInlineOpen ? t('pro.grid.hide') : t('pro.grid.view')}
					>
						{isInlineOpen ? (
							t('pro.grid.hide')
						) : (
							<>
								<EyeIcon className="w-3.5 h-3.5 shrink-0" />
								{t('pro.grid.view')}
							</>
						)}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}
						onClick={handleMenuButtonClick}
						variant="ghost"
						size="icon"
						className="absolute top-1.5 right-1.5 z-10 h-7 w-7 bg-(--desktop-surface-panel-strong) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--desktop-surface-soft-hover)"
						title={t('pro.menu.more')}
						aria-label={t('pro.menu.more')}
					>
						<EllipsisHorizontalIcon className="w-4 h-4 text-(--desktop-text-muted)" />
					</DesktopAppButton>
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

			{/* Инфо-блок: 2–3 визуальных ряда максимум; видимость в одной строке с размером/датами */}
			<div
				className={cn(
					'flex min-h-0 min-w-0 flex-col gap-0.5 px-2 py-1',
					embedded
						? getDesktopShellFileCardMetaClassName(shellFrame)
						: 'border-t border-(--desktop-border-subtle)'
				)}
			>
				<h3
					className="line-clamp-2 text-[11px] font-medium leading-tight tracking-tight text-(--desktop-text-primary)"
					title={displayLabel}
				>
					{displayLabel}
				</h3>
				{item.description ? (
					<p
						className="line-clamp-1 text-[10px] leading-tight text-(--desktop-text-muted)"
						title={item.description}
					>
						{item.description}
					</p>
				) : null}
				<ContentManagerProcessingFailedAffordance
					item={item}
					displayLabel={displayLabel}
					onReprocess={onReprocessDisplay}
					layout="card"
				/>
				<div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 text-[9px] leading-tight text-(--desktop-text-dim) tabular-nums">
					<span className="shrink-0 font-medium text-(--desktop-text-muted)">
						{formatBytes(item.file_size ?? 0, lang)}
					</span>
					<span className="text-(--desktop-text-dim)/80" aria-hidden>
						·
					</span>
					<span
						className="min-w-0 truncate"
						title={formatDateFullLocal(item.created_at)}
					>
						{t('pro.grid.created', {
							date: formatDateRelativeLocal(item.created_at),
						})}
					</span>
					<span className="text-(--desktop-text-dim)/80" aria-hidden>
						·
					</span>
					<span
						className="min-w-0 truncate"
						title={formatDateFullLocal(item.updated_at)}
					>
						{t('pro.grid.updated', {
							date: formatDateRelativeLocal(item.updated_at),
						})}
					</span>
					{item.visibility
						? (() => {
								const displayVis = getDisplayVisibility(item, filterVisibility);
								const colorClass =
									displayVis === 'from_friends'
										? 'text-zinc-300'
										: displayVis === 'friends' || displayVis === 'public'
											? 'text-zinc-400'
											: displayVis === 'shared'
												? 'text-zinc-300'
												: 'text-(--desktop-text-dim)';
								return (
									<>
										<span className="text-(--desktop-text-dim)/80" aria-hidden>
											·
										</span>
										<span
											className={`shrink-0 font-medium ${colorClass}`}
											title={visibilityLabel(displayVis)}
										>
											{visibilityLabel(displayVis)}
										</span>
									</>
								);
							})()
						: null}
				</div>
				{item.tags?.length > 0 ? (
					<div className="flex flex-wrap gap-0.5 pt-0.5">
						{item.tags.slice(0, 3).map((tag) => (
							<DesktopAppStatusBadge
								key={tag}
								className="rounded px-1 py-px text-[9px] font-normal"
							>
								#{tag}
							</DesktopAppStatusBadge>
						))}
					</div>
				) : null}
			</div>

			{showTooltip && !menuPosition && (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 6 }}
						transition={{ duration: 0.15 }}
						className="pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-3 shadow-(--desktop-shadow-panel) backdrop-blur-md"
					>
						<div className="space-y-2 text-xs">
							<div className="flex justify-between gap-3">
								<span className="text-(--desktop-text-dim) font-medium">
									{t('pro.grid.metaType')}
								</span>
								<span className={`tabular-nums ${config.color}`}>
									{typeLabel}
								</span>
							</div>
							<div className="flex justify-between gap-3">
								<span className="text-(--desktop-text-dim) font-medium">
									{t('pro.grid.metaSize')}
								</span>
								<span className="text-(--desktop-text-primary) tabular-nums">
									{formatBytes(item.file_size ?? 0, lang)}
								</span>
							</div>
							<div className="flex justify-between gap-3">
								<span className="text-(--desktop-text-dim) font-medium">
									{t('pro.grid.metaCreated')}
								</span>
								<span className="text-(--desktop-text-secondary) tabular-nums">
									{formatDateShort(item.created_at, lang)}
								</span>
							</div>
							<div className="flex justify-between gap-3">
								<span className="text-(--desktop-text-dim) font-medium">
									{t('pro.grid.metaUpdated')}
								</span>
								<span className="text-(--desktop-text-secondary) tabular-nums">
									{formatDateShort(item.updated_at, lang)}
								</span>
							</div>
							{item.visibility && (
								<div className="flex justify-between gap-3">
									<span className="text-(--desktop-text-dim) font-medium">
										{t('pro.grid.metaVisibility')}
									</span>
									<span
										className={(() => {
											const d = getDisplayVisibility(item, filterVisibility);
											return d === 'from_friends'
												? 'text-zinc-300'
												: d === 'friends' || d === 'public'
													? 'text-zinc-400'
													: d === 'shared'
														? 'text-zinc-300'
														: 'text-(--desktop-text-secondary)';
										})()}
									>
										{visibilityLabel(
											getDisplayVisibility(item, filterVisibility)
										)}
									</span>
								</div>
							)}
							{item.description && (
								<p className="mt-2 line-clamp-2 border-t border-(--desktop-border-subtle) pt-2 text-(--desktop-text-muted) leading-relaxed">
									{item.description}
								</p>
							)}
						</div>
					</motion.div>
				</AnimatePresence>
			)}
		</div>
	);
}

export const FileCard = React.memo(ContentManagerFileCardInner);
FileCard.displayName = 'FileCard';
