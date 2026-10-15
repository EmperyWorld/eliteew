/**
 * File Library Panel
 *
 * Panel for opening documents from Unified Content library.
 * Integrates FileGrabber for file selection with document-specific filtering.
 *
 * Features:
 * - Browse all document-type files from library
 * - Filter by document types (document, presentation, spreadsheet)
 * - Quick actions for recent files
 * - Type-safe integration with file-exchange system
 *
 * Created: 2025-10-24
 */

import { DESKTOP_OVERLAY, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useState } from 'react';
import {
	ArrowPathIcon,
	FolderOpenIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { type FileId, ContentType } from '../../../types/fileExchange';
import FileGrabber from '../../file-exchange/FileGrabber';

// ============================================================================
// TYPES
// ============================================================================

interface FileLibraryPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectFile: (fileId: FileId) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Content types supported in the document editor
 */
const DOCUMENT_CONTENT_TYPES: readonly ContentType[] = [
	ContentType.DOCUMENT,
	ContentType.IMAGE, // For embedded images
	ContentType.OTHER, // For generic files
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const FileLibraryPanel: React.FC<FileLibraryPanelProps> = ({
	isOpen,
	onClose,
	onSelectFile,
}) => {
	const { t } = useTranslation('docEditorPanels');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [grabberRetryKey, setGrabberRetryKey] = useState(0);
	const maxFiles = 1;

	/**
	 * Handles file selection from FileGrabber
	 */
	const handleFileSelect = (fileIds: readonly FileId[]): void => {
		if (fileIds.length > 0 && fileIds[0]) {
			onSelectFile(fileIds[0]);
			onClose();
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className={cn(
				'fixed inset-0 flex items-center justify-center',
				DESKTOP_OVERLAY.backdrop
			)}
			style={{ zIndex: embeddedModalZ.backdrop }}
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.95, opacity: 0 }}
				className="flex h-[min(92vh,900px)] w-[min(96vw,960px)] min-h-0 flex-col overflow-hidden rounded-xl border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-xl"
				style={{ zIndex: embeddedModalZ.content }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header — одна плотная строка */}
				<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2">
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-2">
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600 shadow-sm">
								<FolderOpenIcon width={18} height={18} className="text-white" />
							</div>
							<div className="min-w-0">
								<h2
									className={cn(
										DESKTOP_TYPOGRAPHY.title,
										'truncate text-base font-semibold'
									)}
								>
									{t('panels.fileLibrary.title')}
								</h2>
								<p className="truncate text-[11px] text-(--desktop-text-muted)">
									{t('panels.fileLibrary.subtitleShort')}
								</p>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 gap-1 px-2 text-xs"
								onClick={() => setGrabberRetryKey((k) => k + 1)}
							>
								<ArrowPathIcon className="size-3.5" aria-hidden />
								{t('panels.fileLibrary.retryList')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={onClose}
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								aria-label={t('panels.fileLibrary.closeAria')}
							>
								<XMarkIcon className="h-5 w-5 text-(--desktop-text-muted)" />
							</DesktopAppButton>
						</div>
					</div>
					<p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-(--desktop-text-muted)">
						{t('panels.fileLibrary.limitHint', { max: maxFiles })}
					</p>
				</div>

				{/* FileGrabber: максимум высоты — список */}
				<div
					className={cn(
						'flex min-h-0 flex-1 flex-col overflow-hidden',
						'**:[[role=checkbox]]:min-h-10 **:[[role=checkbox]]:items-center **:[[role=checkbox]]:gap-2 **:[[role=checkbox]]:py-2',
						'[&_[role=checkbox][aria-checked=true]]:border-[rgb(var(--desktop-accent-rgb))]/35 [&_[role=checkbox][aria-checked=true]]:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,transparent)] [&_[role=checkbox][aria-checked=true]]:ring-2 [&_[role=checkbox][aria-checked=true]]:ring-[rgb(var(--desktop-accent-rgb))]/25',
						'[&_[role=checkbox]_p]:min-w-0 [&_[role=checkbox]_p]:truncate [&_[role=checkbox]_p]:text-left'
					)}
				>
					<div className="min-h-0 flex-1 overflow-hidden">
						<FileGrabber
							key={grabberRetryKey}
							isOpen={true}
							onClose={onClose}
							onSelect={handleFileSelect}
							multiSelect={false}
							fileTypes={DOCUMENT_CONTENT_TYPES}
							maxFiles={maxFiles}
							embedded={true}
						/>
					</div>
				</div>

				<div className="shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1.5">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'text-[10px] leading-snug text-(--desktop-text-dim)'
						)}
					>
						{t('panels.fileLibrary.footerHint')}
					</p>
				</div>
			</motion.div>
		</motion.div>
	);
};
