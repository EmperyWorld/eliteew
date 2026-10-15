/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen preview modal for Content Manager grid/list view when inline preview is not used.
 *
 * Invariants:
 * - Preview navigation only moves through the visible list supplied by the parent.
 * - Download names are resolved before invoking the parent download handler.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 * - `ContentManagerPreviews.tsx`
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { formatDateShort } from '../../../components/UnifiedContent/utils/contentUtils';
import { buildContentBlobCacheRevision } from '../../../services/contentApi';
import { cn } from '../../../utils/cn';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppModalFrame,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { MediaPreview, TextPreview } from './ContentManagerPreviews';
import { TYPE_CONFIG } from './ContentManagerTypeConfig';
import {
	ArrowDownTrayIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DocumentIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

import {
	contentManagerDisplayLabel,
	isTextLikeContent,
	resolvedContentDownloadFileName,
	resolvedContentListFileName,
} from '../utils/contentManagerTextLike';

export type ContentManagerPreviewModalProps = {
	item: ContentItem | null;
	embedded: boolean;
	previewViewport: { top: number; height: number } | null;
	onClose: () => void;
	formatFileSize: (bytes: number) => string;
	resolveContentTypeLabel: (contentType: string) => string;
	onDownload: (id: string, name: string) => void;
	onDelete?: () => void;
	deleteLabel?: string;
	onPrevious?: () => void;
	onNext?: () => void;
	previousDisabled?: boolean;
	nextDisabled?: boolean;
	positionLabel?: string | null;
};

export function ContentManagerPreviewModal({
	item,
	embedded,
	previewViewport,
	onClose,
	formatFileSize,
	resolveContentTypeLabel,
	onDownload,
	onDelete,
	deleteLabel,
	onPrevious,
	onNext,
	previousDisabled = true,
	nextDisabled = true,
	positionLabel,
}: ContentManagerPreviewModalProps): React.ReactElement {
	const { t, i18n } = useTranslation('contentManager');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const blobRevision = item ? buildContentBlobCacheRevision(item) : '';

	const previewFileName = item ? resolvedContentListFileName(item) : '';
	const downloadFileName = item ? resolvedContentDownloadFileName(item) : '';
	const headerLabel = item ? contentManagerDisplayLabel(item) : '';

	React.useEffect(() => {
		if (!item) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			const target = event.target;
			const inEditableField =
				target instanceof HTMLElement &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.tagName === 'SELECT' ||
					target.isContentEditable);
			if (inEditableField) return;

			if (event.key === 'ArrowLeft' && onPrevious && !previousDisabled) {
				event.preventDefault();
				onPrevious();
			}
			if (event.key === 'ArrowRight' && onNext && !nextDisabled) {
				event.preventDefault();
				onNext();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [item, nextDisabled, onNext, onPrevious, previousDisabled]);

	return (
		<AnimatePresence>
			{item && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={
						embedded
							? 'absolute left-0 right-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
							: 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
					}
					style={{
						zIndex: embeddedModalZ.backdrop,
						...(embedded && previewViewport
							? {
									top: previewViewport.top,
									height: previewViewport.height,
								}
							: {}),
					}}
					onClick={onClose}
					// Блокируем всплытие wheel-событий вверх по дереву,
					// чтобы не триггерить глобальные обработчики.
					onWheelCapture={(e) => {
						e.stopPropagation();
					}}
					onWheel={(e) => {
						e.stopPropagation();
					}}
					onScrollCapture={(e) => {
						e.stopPropagation();
					}}
				>
					<motion.div
						initial={{ scale: 0.95 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.95 }}
						className={embedded ? 'w-full max-w-full' : 'w-full max-w-3xl'}
						style={{ zIndex: embeddedModalZ.content }}
						onClick={(e) => e.stopPropagation()}
					>
						<DesktopAppModalFrame
							title={
								<div className="flex min-w-0 items-center gap-3">
									<div
										className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--desktop-border-subtle) ${TYPE_CONFIG[item.content_type]?.bg || 'bg-zinc-700/30'} ${TYPE_CONFIG[item.content_type]?.color || 'text-zinc-400'}`}
									>
										{TYPE_CONFIG[item.content_type]?.icon || (
											<DocumentIcon className="h-5 w-5" />
										)}
									</div>
									<div className="min-w-0">
										<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{headerLabel}
										</div>
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'font-medium tabular-nums'
											)}
										>
											{formatFileSize(item.file_size ?? 0)}
										</div>
									</div>
								</div>
							}
							onClose={onClose}
							className={
								embedded
									? 'max-h-[90%] max-w-full flex flex-col'
									: 'max-h-[85vh] max-w-3xl flex flex-col'
							}
						>
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
								<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) px-4 py-3">
									<div className="flex min-w-0 items-center gap-2">
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											onClick={onPrevious}
											disabled={previousDisabled || !onPrevious}
											aria-label={t('pro.preview.previous')}
										>
											<ChevronLeftIcon className="h-4 w-4" />
											<span className="hidden sm:inline">
												{t('pro.preview.previous')}
											</span>
										</DesktopAppButton>
										{positionLabel ? (
											<span className="truncate text-xs font-medium text-(--desktop-text-muted)">
												{positionLabel}
											</span>
										) : null}
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											onClick={onNext}
											disabled={nextDisabled || !onNext}
											aria-label={t('pro.preview.next')}
										>
											<span className="hidden sm:inline">
												{t('pro.preview.next')}
											</span>
											<ChevronRightIcon className="h-4 w-4" />
										</DesktopAppButton>
									</div>
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										onClick={() => onDownload(item.id, downloadFileName)}
									>
										<ArrowDownTrayIcon className="h-4 w-4" />
										{t('pro.preview.download')}
									</DesktopAppButton>
								</div>
								<div className="min-h-0 flex-1 overflow-y-auto p-4">
									{item.content_type === 'image' ? (
										<MediaPreview
											contentId={item.id}
											contentRevision={blobRevision}
											type="image"
											name={headerLabel}
										/>
									) : item.content_type === 'video' ? (
										<MediaPreview
											contentId={item.id}
											contentRevision={blobRevision}
											type="video"
											name={headerLabel}
										/>
									) : item.content_type === 'audio' ? (
										<MediaPreview
											contentId={item.id}
											contentRevision={blobRevision}
											type="audio"
											name={headerLabel}
										/>
									) : item.mime_type === 'application/pdf' ? (
										<MediaPreview
											contentId={item.id}
											contentRevision={blobRevision}
											type="pdf"
											name={headerLabel}
										/>
									) : isTextLikeContent(item) ? (
										<TextPreview
											contentId={item.id}
											contentRevision={blobRevision}
											fileName={previewFileName}
											mimeType={item.mime_type}
										/>
									) : (
										<DesktopAppEmptyState
											icon={
												<div
													className={`flex h-16 w-16 items-center justify-center rounded-xl border border-(--desktop-border-subtle) ${TYPE_CONFIG[item.content_type]?.bg || 'bg-zinc-700/30'} ${TYPE_CONFIG[item.content_type]?.color || 'text-zinc-400'}`}
												>
													{TYPE_CONFIG[item.content_type]?.icon || (
														<DocumentIcon className="h-8 w-8" />
													)}
												</div>
											}
											title={t('pro.preview.noPreviewTitle')}
											description={t('pro.preview.noPreviewDesc')}
										>
											<DesktopAppButton
												type="button"
												variant="accent"
												onClick={() => onDownload(item.id, downloadFileName)}
											>
												<ArrowDownTrayIcon className="h-4 w-4" />
												{t('pro.preview.downloadFile')}
											</DesktopAppButton>
										</DesktopAppEmptyState>
									)}
								</div>
								<div className="shrink-0 space-y-3 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-4 py-4">
									<div className="grid grid-cols-2 gap-4 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-4 text-xs md:grid-cols-4">
										<div className="py-1">
											<p className="mb-1 font-medium text-(--desktop-text-dim)">
												{t('pro.preview.metaType')}
											</p>
											<p className="font-medium text-(--desktop-text-primary)">
												{resolveContentTypeLabel(item.content_type)}
											</p>
										</div>
										<div className="py-1">
											<p className="mb-1 font-medium text-(--desktop-text-dim)">
												{t('pro.preview.metaSize')}
											</p>
											<p className="tabular-nums text-(--desktop-text-primary)">
												{formatFileSize(item.file_size ?? 0)}
											</p>
										</div>
										<div className="py-1">
											<p className="mb-1 font-medium text-(--desktop-text-dim)">
												{t('pro.preview.metaCreated')}
											</p>
											<p className="tabular-nums text-(--desktop-text-primary)">
												{formatDateShort(item.created_at, i18n.language)}
											</p>
										</div>
										<div className="py-1">
											<p className="mb-1 font-medium text-(--desktop-text-dim)">
												{t('pro.preview.mime')}
											</p>
											<p
												className="truncate text-(--desktop-text-primary)"
												title={item.mime_type ?? undefined}
											>
												{item.mime_type ?? t('pro.preview.unknownMime')}
											</p>
										</div>
									</div>
									{onDelete ? (
										<div className="flex justify-end">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												className="border border-red-400/20 text-red-200/80 hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-50"
												onClick={onDelete}
											>
												<TrashIcon className="h-4 w-4" />
												{deleteLabel ?? t('pro.preview.delete')}
											</DesktopAppButton>
										</div>
									) : null}
								</div>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
