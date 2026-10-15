/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Rich card for a Unified Content item (favorites, hover preview, quick actions).
 *
 * Invariants:
 * - Thumbnail uses `ContentThumbnail` (authenticated blob), not `thumbnail_url` on `<img>` (401 on protected API).
 * - Audio rows skip remote thumbnail fetch and show the type icon instead.
 * - Context menu mounts via ShellPortalMount (no createPortal(document.body)).
 *
 * Related:
 * - ContentThumbnail.tsx; HoverPreview.tsx.
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (U3.1-B)
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { log } from '../../../../utils/logger';
import { ContentType } from '@/types/fileExchange';
import type { Content } from '../../types';
import { ContentThumbnail } from '../ContentThumbnail/ContentThumbnail';
import { formatBytes, formatDate, getFileIcon } from '../../utils/contentUtils';
import { HoverPreview } from '../HoverPreview';
import {
	ArrowDownTrayIcon,
	ArrowTopRightOnSquareIcon,
	CalendarIcon,
	CheckIcon,
	EyeIcon,
	LinkIcon,
	PencilSquareIcon,
	ServerIcon,
	StarIcon,
	TagIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

export type FileCardAction =
	| 'view'
	| 'download'
	| 'edit'
	| 'delete'
	| 'share'
	| 'copy-link';

interface FileCardProps {
	content: Content;
	selected: boolean;
	isFavorite?: boolean;
	onSelect: (id: string, multi: boolean) => void;
	onClick: (content: Content) => void;
	/**
	 * Семантические хендлеры действий.
	 * Рекомендуется использовать их, а не onQuickAction.
	 */
	onView?: (content: Content) => void;
	onDownload?: (content: Content) => void;
	onEdit?: (content: Content) => void;
	onDelete?: (content: Content) => void;
	onShare?: (content: Content) => void;
	onCopyLink?: (content: Content) => void;
	/**
	 * Универсальный колбэк для действий.
	 * Вызывается в дополнение к onView/onDownload/... (если заданы).
	 */
	onQuickAction?: (id: string, action: FileCardAction) => void;
	onToggleFavorite?: (id: string) => void;
	/** Вызывается при drop другого элемента на эту карточку (draggedId → targetId). Родитель может выполнить перемещение в папку или смену порядка. */
	onDropMove?: (draggedId: string, targetId: string) => void;
	showContextMenu?: boolean;
	/** Roving tabindex for virtualized grids (-1 skips tab order). */
	cardTabIndex?: number;
	/** Arrow / Home / End for virtualized grid navigation */
	onArrowGridNavigate?: (key: string, contentId: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
	content,
	selected,
	isFavorite = false,
	onSelect,
	onClick,
	onView,
	onDownload,
	onEdit,
	onDelete,
	onShare,
	onCopyLink,
	onQuickAction,
	onToggleFavorite,
	onDropMove,
	showContextMenu = true,
	cardTabIndex,
	onArrowGridNavigate,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const [isHovered, setIsHovered] = useState(false);
	const [contextMenuOpen, setContextMenuOpen] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [resolvedMenuPosition, setResolvedMenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
	const [showHoverPreview, setShowHoverPreview] = useState(false);
	const contextMenuRef = useRef<HTMLDivElement | null>(null);
	const hoverCloseTimerRef = useRef<number | null>(null);
	const fileNameHeadingId = useId();
	const selectCheckboxLabel = selected
		? `${t('fileCard.deselect')}: ${content.name}`
		: `${t('fileCard.select')}: ${content.name}`;
	const sectionTabIndex = cardTabIndex ?? 0;

	const handleCardClick = useCallback(
		(e: React.MouseEvent): void => {
			// Не триггерить если клик на кнопки
			if ((e.target as HTMLElement).closest('button')) {
				return;
			}
			// Клик по карточке считаем \"просмотром\".
			if (onView) {
				onView(content);
			} else {
				onClick(content);
			}
		},
		[content, onClick, onView]
	);

	const handleCheckboxClick = useCallback(
		(e: React.MouseEvent): void => {
			e.stopPropagation();
			onSelect(content.id, e.shiftKey || e.ctrlKey || e.metaKey);
		},
		[content.id, onSelect]
	);

	const handleCardKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>): void => {
			const target = e.target as HTMLElement;
			if (target.closest('button, input, textarea, select, a[href]')) {
				return;
			}
			if (
				onArrowGridNavigate &&
				(e.key === 'ArrowLeft' ||
					e.key === 'ArrowRight' ||
					e.key === 'ArrowUp' ||
					e.key === 'ArrowDown' ||
					e.key === 'Home' ||
					e.key === 'End')
			) {
				e.preventDefault();
				onArrowGridNavigate(e.key, content.id);
				return;
			}
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (onView) {
					onView(content);
				} else {
					onClick(content);
				}
			}
		},
		[content, onClick, onView, onArrowGridNavigate]
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent): void => {
			if (!showContextMenu) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			setContextMenuPosition({ x: e.clientX, y: e.clientY });
			setContextMenuOpen(true);
		},
		[showContextMenu]
	);

	useLayoutEffect(() => {
		if (
			!contextMenuOpen ||
			!contextMenuPosition ||
			typeof window === 'undefined'
		) {
			setResolvedMenuPosition(null);
			return;
		}

		const updatePosition = (): void => {
			const menuWidth = contextMenuRef.current?.offsetWidth ?? 188;
			const menuHeight = contextMenuRef.current?.offsetHeight ?? 280;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const margin = 12;
			const cursorGap = 4;
			const flipGap = 8;

			const preferredX = contextMenuPosition.x + cursorGap;
			const preferredY = contextMenuPosition.y + cursorGap;

			let nextX = preferredX;
			if (preferredX + menuWidth > viewportWidth - margin) {
				const flippedX = contextMenuPosition.x - menuWidth - flipGap;
				nextX =
					flippedX >= margin ? flippedX : viewportWidth - menuWidth - margin;
			}

			let nextY = preferredY;
			if (preferredY + menuHeight > viewportHeight - margin) {
				const flippedY = contextMenuPosition.y - menuHeight - flipGap;
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

			setResolvedMenuPosition((previous) =>
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
	}, [contextMenuOpen, contextMenuPosition]);

	useEffect(() => {
		if (!contextMenuOpen || typeof window === 'undefined') {
			return;
		}

		const handlePointerDown = (event: MouseEvent): void => {
			const target = event.target;
			if (target instanceof Node && contextMenuRef.current?.contains(target)) {
				return;
			}
			setContextMenuOpen(false);
		};

		const handleEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setContextMenuOpen(false);
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
	}, [contextMenuOpen]);

	useEffect(() => {
		return () => {
			if (hoverCloseTimerRef.current !== null) {
				window.clearTimeout(hoverCloseTimerRef.current);
			}
		};
	}, []);

	const handleFavoriteClick = useCallback(
		(e: React.MouseEvent): void => {
			e.stopPropagation();
			onToggleFavorite?.(content.id);
		},
		[content.id, onToggleFavorite]
	);

	const handleHoverStart = useCallback((): void => {
		if (hoverCloseTimerRef.current !== null) {
			window.clearTimeout(hoverCloseTimerRef.current);
			hoverCloseTimerRef.current = null;
		}
		setIsHovered(true);
		setShowHoverPreview(true);
	}, []);

	const handleHoverEnd = useCallback((): void => {
		if (hoverCloseTimerRef.current !== null) {
			window.clearTimeout(hoverCloseTimerRef.current);
		}
		hoverCloseTimerRef.current = window.setTimeout(() => {
			setIsHovered(false);
			setShowHoverPreview(false);
			hoverCloseTimerRef.current = null;
		}, 90);
	}, []);

	// Drag & Drop handlers
	const handleDragStart = useCallback(
		(e: React.DragEvent): void => {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', content.id);
			e.dataTransfer.setData('application/json', JSON.stringify(content));
			(e.target as HTMLElement).style.opacity = '0.5';
		},
		[content]
	);

	const handleDragEnd = useCallback((e: React.DragEvent): void => {
		(e.target as HTMLElement).style.opacity = '1';
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent): void => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent): void => {
			e.preventDefault();
			const draggedId = e.dataTransfer.getData('text/plain');
			if (draggedId && draggedId !== content.id) {
				if (onDropMove) {
					onDropMove(draggedId, content.id);
				} else {
					log.info(
						'FileCard',
						`Move ${draggedId} to ${content.id} (onDropMove not provided)`
					);
				}
			}
		},
		[content.id, onDropMove]
	);

	const handleAction = useCallback(
		(action: FileCardAction, e?: React.MouseEvent): void => {
			if (e) {
				e.stopPropagation();
			}

			switch (action) {
				case 'view':
					if (onView) {
						onView(content);
					} else {
						onClick(content);
					}
					break;
				case 'download':
					onDownload?.(content);
					break;
				case 'edit':
					onEdit?.(content);
					break;
				case 'delete':
					onDelete?.(content);
					break;
				case 'share':
					onShare?.(content);
					break;
				case 'copy-link':
					onCopyLink?.(content);
					break;
			}

			if (onQuickAction) {
				onQuickAction(content.id, action);
			}
		},
		[
			content,
			onClick,
			onView,
			onDownload,
			onEdit,
			onDelete,
			onShare,
			onCopyLink,
			onQuickAction,
		]
	);

	const formatRelativeTime = (dateString: string): string => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInMs = now.getTime() - date.getTime();
		const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
		const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
		const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

		if (diffInMinutes < 1) return t('fileCard.relativeJustNow');
		if (diffInMinutes < 60)
			return t('fileCard.relativeMinutes', { n: diffInMinutes });
		if (diffInHours < 24)
			return t('fileCard.relativeHours', { n: diffInHours });
		if (diffInDays === 1) return t('fileCard.relativeYesterday');
		if (diffInDays < 7) return t('fileCard.relativeDays', { n: diffInDays });
		if (diffInDays < 30)
			return t('fileCard.relativeWeeks', { n: Math.floor(diffInDays / 7) });

		return formatDate(dateString, i18n.language);
	};

	const FileIcon = getFileIcon(content.content_type);

	return (
		<>
			<motion.div
				layout
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				transition={{ duration: 0.18, ease: 'easeOut' }}
				onHoverStart={handleHoverStart}
				onHoverEnd={handleHoverEnd}
				onMouseMove={(e) => {
					setMousePosition({ x: e.clientX, y: e.clientY });
				}}
				onClick={handleCardClick}
				onContextMenu={handleContextMenu}
			>
				<section
					data-uc-file-card-id={content.id}
					draggable={true}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					tabIndex={sectionTabIndex}
					aria-labelledby={fileNameHeadingId}
					onKeyDown={handleCardKeyDown}
					className={`
          relative group cursor-pointer outline-none
          bg-linear-to-br from-white/5 via-white/5 to-white/5
          rounded-xl border backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-200
          ${
						selected
							? 'border-purple-500 shadow-lg shadow-purple-500/30 bg-purple-500/10 focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:shadow-[0_0_0_1px_rgba(192,132,252,0.35)]'
							: 'border-white/10 hover:border-purple-400/50 hover:bg-white/8 hover:shadow-lg hover:shadow-purple-500/10 focus-within:z-1 focus-within:border-purple-400/50 focus-within:bg-white/8 focus-within:shadow-lg focus-within:shadow-purple-500/10 focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:border-purple-400/60'
					}
        `}
				>
					{/* Checkbox */}
					{/* biome-ignore lint/a11y/useSemanticElements: custom-styled grid checkbox; matches card chrome */}
					<button
						type="button"
						role="checkbox"
						aria-checked={selected}
						aria-label={selectCheckboxLabel}
						onClick={handleCheckboxClick}
						className={`
            absolute top-2 left-2 z-20 w-5 h-5 rounded-md border-2
            flex items-center justify-center transition-opacity duration-150
            ${
							selected
								? 'bg-purple-500 border-purple-500 shadow-md'
								: 'bg-black/60 backdrop-blur-sm border-white/40 hover:border-purple-400'
						}
            ${
							isHovered || selected
								? 'opacity-100'
								: 'opacity-0 group-focus-within:opacity-100'
						}
            focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
          `}
					>
						{selected && (
							<CheckIcon className="w-3 h-3 text-white" aria-hidden />
						)}
					</button>

					{/* Favorite Button */}
					{onToggleFavorite && (
						<button
							type="button"
							onClick={handleFavoriteClick}
							className={`
              absolute top-2 right-2 z-20 w-7 h-7 rounded-md
              flex items-center justify-center transition-opacity duration-150
              ${
								isFavorite
									? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
									: 'bg-black/60 backdrop-blur-sm text-gray-400 border border-white/20 hover:border-yellow-500/50'
							}
              ${
								isHovered || isFavorite
									? 'opacity-100'
									: 'opacity-0 group-focus-within:opacity-100'
							}
              focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
            `}
							aria-label={
								isFavorite
									? t('fileCard.removeFavorite')
									: t('fileCard.addFavorite')
							}
						>
							{isFavorite ? (
								<StarIcon className="w-4 h-4 fill-current" />
							) : (
								<StarIcon className="w-4 h-4" />
							)}
						</button>
					)}

					{/* Thumbnail/Preview — fixed 16:10 frame for consistent grid rhythm */}
					<div className="relative aspect-16/10 bg-linear-to-br from-purple-900/20 to-pink-900/20 rounded-t-xl overflow-hidden">
						{content.content_type === ContentType.AUDIO ? (
							<div className="flex h-full w-full items-center justify-center text-purple-400/60">
								{FileIcon}
							</div>
						) : (
							<ContentThumbnail
								contentId={content.id}
								fillParent
								alt={content.name}
								className="transition-transform duration-300 group-hover:scale-[1.02]"
							>
								<div className="flex size-full flex-col items-center justify-center gap-1 text-purple-400/70">
									{FileIcon}
								</div>
							</ContentThumbnail>
						)}

						{/* Quick Actions Overlay */}
						<AnimatePresence>
							{isHovered && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="pointer-events-none absolute inset-0 flex items-end justify-center gap-2 bg-linear-to-t from-black/90 via-black/60 to-transparent pb-3 backdrop-blur-sm"
								>
									<motion.button
										type="button"
										tabIndex={isHovered ? 0 : -1}
										initial={{ y: 10, opacity: 0 }}
										animate={{ y: 0, opacity: 1 }}
										onClick={(e) => handleAction('view', e)}
										className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-green-500/50 bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30 hover:text-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
										title={t('fileCard.view')}
										aria-label={t('fileCard.view')}
									>
										<EyeIcon className="w-4 h-4" />
									</motion.button>
									<motion.button
										type="button"
										tabIndex={isHovered ? 0 : -1}
										initial={{ y: 10, opacity: 0 }}
										animate={{ y: 0, opacity: 1 }}
										transition={{ delay: 0.05 }}
										onClick={(e) => handleAction('download', e)}
										className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/50 bg-blue-500/20 text-blue-400 transition-colors hover:bg-blue-500/30 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
										title={t('fileCard.download')}
										aria-label={t('fileCard.download')}
									>
										<ArrowDownTrayIcon className="w-4 h-4" />
									</motion.button>
									<motion.button
										type="button"
										tabIndex={isHovered ? 0 : -1}
										initial={{ y: 10, opacity: 0 }}
										animate={{ y: 0, opacity: 1 }}
										transition={{ delay: 0.1 }}
										onClick={(e) => handleAction('edit', e)}
										className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/50 bg-purple-500/20 text-purple-400 transition-colors hover:bg-purple-500/30 hover:text-purple-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
										title={t('fileCard.edit')}
										aria-label={t('fileCard.edit')}
									>
										<PencilSquareIcon className="w-4 h-4" />
									</motion.button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* File Info */}
					<div className="min-w-0 space-y-2 p-3">
						{/* File Name */}
						<h3
							id={fileNameHeadingId}
							className="block min-w-0 truncate text-sm font-medium leading-tight text-white"
							title={content.name}
						>
							{content.name}
						</h3>

						{/* Metadata Row — icon dim, values slightly brighter; dot separator */}
						<div className="flex min-w-0 items-center gap-2 text-xs">
							<div className="flex min-w-0 flex-1 items-center gap-1.5 text-gray-300">
								<CalendarIcon
									className="h-3 w-3 shrink-0 text-gray-500"
									aria-hidden
								/>
								<span className="sr-only">Создано: </span>
								<span
									className="min-w-0 truncate tabular-nums"
									title={formatRelativeTime(content.created_at)}
								>
									{formatRelativeTime(content.created_at)}
								</span>
							</div>
							<span className="shrink-0 text-gray-600" aria-hidden>
								·
							</span>
							<div className="flex min-w-0 max-w-[48%] shrink-0 items-center gap-1.5 text-gray-300">
								<ServerIcon
									className="h-3 w-3 shrink-0 text-gray-500"
									aria-hidden
								/>
								<span className="sr-only">Размер: </span>
								<span
									className="min-w-0 truncate tabular-nums font-medium text-gray-200"
									title={formatBytes(content.file_size, i18n.language)}
								>
									{formatBytes(content.file_size, i18n.language)}
								</span>
							</div>
						</div>

						{/* Tags (первые 2) */}
						{content.tags && content.tags.length > 0 && (
							<div className="flex items-center gap-1 flex-wrap">
								<TagIcon className="w-3 h-3 text-purple-400/60" />
								{content.tags.slice(0, 2).map((tag) => (
									<span
										key={tag}
										className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs"
									>
										{tag}
									</span>
								))}
								{content.tags.length > 2 && (
									<span className="text-xs text-gray-500">
										+{content.tags.length - 2}
									</span>
								)}
							</div>
						)}
					</div>

					{/* Selected Glow Effect */}
					{selected && (
						<div className="absolute inset-0 rounded-xl pointer-events-none">
							<div className="absolute inset-0 rounded-xl bg-linear-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 animate-pulse" />
						</div>
					)}
				</section>
			</motion.div>

			{/* Context Menu */}
			{typeof document !== 'undefined' &&
			contextMenuOpen &&
			resolvedMenuPosition ? (
				<ShellPortalMount layer="embedded_popover">
					<AnimatePresence>
						<motion.div
							ref={contextMenuRef}
							initial={{ opacity: 0, scale: 0.95, y: 6 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 6 }}
							className="fixed min-w-[180px] rounded-lg border border-white/20 bg-black/90 py-1 shadow-xl shadow-purple-500/20 backdrop-blur-xl"
							style={{
								left: resolvedMenuPosition.x,
								top: resolvedMenuPosition.y,
								zIndex: portalStackBase,
							}}
						>
							<button
								type="button"
								onClick={(e) => {
									handleAction('view', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
							>
								<EyeIcon className="w-4 h-4" />
								{t('fileCard.view')}
							</button>
							<button
								type="button"
								onClick={(e) => {
									handleAction('download', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
							>
								<ArrowDownTrayIcon className="w-4 h-4" />
								{t('fileCard.download')}
							</button>
							<button
								type="button"
								onClick={(e) => {
									handleAction('edit', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
							>
								<PencilSquareIcon className="w-4 h-4" />
								{t('fileCard.edit')}
							</button>
							<div className="my-1 border-t border-white/10" />
							<button
								type="button"
								onClick={(e) => {
									handleAction('share', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
							>
								<ArrowTopRightOnSquareIcon className="w-4 h-4" />
								{t('fileCard.share')}
							</button>
							<button
								type="button"
								onClick={(e) => {
									handleAction('copy-link', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-white hover:bg-white/10"
							>
								<LinkIcon className="w-4 h-4" />
								{t('fileCard.copyLink')}
							</button>
							<div className="my-1 border-t border-white/10" />
							<button
								type="button"
								onClick={(e) => {
									handleAction('delete', e);
									setContextMenuOpen(false);
								}}
								className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
							>
								<TrashIcon className="w-4 h-4" />
								{t('fileCard.delete')}
							</button>
						</motion.div>
					</AnimatePresence>
				</ShellPortalMount>
			) : null}

			{/* Hover Preview */}
			<HoverPreview
				content={content}
				isVisible={showHoverPreview && isHovered && !contextMenuOpen}
				mousePosition={mousePosition}
				onClose={() => setShowHoverPreview(false)}
			/>
		</>
	);
};
