/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Queued file list / preview grid for DocumentImportPanel.
 *
 * Invariants:
 * - Empty queue with no results renders empty-state; list hidden when files.length === 0.
 *
 * Related:
 * - DocumentImportPanel.tsx, useDocumentImportFormatHelpers.ts
 */

import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';
import {
	DocumentTextIcon,
	EyeIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { ImportSupportedFormat } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';

type DocumentImportFileListProps = {
	t: TFunction<'docEditorPanels'>;
	files: File[];
	importResultsLength: number;
	showPreview: boolean;
	onTogglePreview: () => void;
	onClearAll: () => void;
	onRemoveFile: (index: number) => void;
	formatFileSize: (bytes: number) => string;
	getFileIcon: (fileName: string) => ImportSupportedFormat;
	getFilePriority: (fileName: string) => number;
	resolveFormatLabel: (format: ImportSupportedFormat) => string;
	getFormatLabel: (fileName: string, formatLabel: string) => string;
	getExtensionMismatchBadge: (fileName: string) => ReactNode;
	getExtensionMismatchSpan: (fileName: string) => ReactNode;
	getProcessingMethodForFile: (fileName: string) => string;
};

export function DocumentImportFileList({
	t,
	files,
	importResultsLength,
	showPreview,
	onTogglePreview,
	onClearAll,
	onRemoveFile,
	formatFileSize,
	getFileIcon,
	getFilePriority,
	resolveFormatLabel,
	getFormatLabel,
	getExtensionMismatchBadge,
	getExtensionMismatchSpan,
	getProcessingMethodForFile,
}: DocumentImportFileListProps) {
	if (files.length === 0 && importResultsLength === 0) {
		return (
			<div className="border-b border-(--desktop-border-subtle) p-5">
				<DesktopAppPanel className="border-dashed border-(--desktop-border-subtle) bg-transparent">
					<DesktopAppEmptyState
						icon={
							<DocumentTextIcon
								className="mx-auto text-(--desktop-text-dim)"
								width={40}
								height={40}
							/>
						}
						title={t('panels.import.queueEmptyTitle')}
						description={t('panels.import.queueEmptyDescription')}
						className="py-8 text-(--desktop-text-muted)"
					/>
				</DesktopAppPanel>
			</div>
		);
	}

	if (files.length === 0) {
		return null;
	}

	return (
		<div
			key="file-list"
			className="border-b border-(--desktop-border-subtle) p-5"
		>
			<div className="flex items-center justify-between mb-4">
				<h4 className="text-sm font-semibold text-(--desktop-text-secondary)">
					{t('panels.import.filesHeading', { count: files.length })}
				</h4>
				<div className="flex items-center gap-2">
					<DesktopAppButton
						onClick={onTogglePreview}
						variant="ghost"
						size="sm"
						className="gap-1"
					>
						<EyeIcon width={14} height={14} />
						{showPreview
							? t('panels.import.viewList')
							: t('panels.import.viewPreview')}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={onClearAll}
						variant="danger"
						size="sm"
						className="gap-1"
					>
						<TrashIcon width={14} height={14} />
						{t('panels.import.clearAll')}
					</DesktopAppButton>
				</div>
			</div>

			{showPreview ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{files.map((file, index) => {
						const format = getFileIcon(file.name);
						const Icon = format.icon;
						const isImage = ['png', 'jpg', 'jpeg'].includes(
							file.name.toLowerCase().split('.').pop() || ''
						);

						return (
							<motion.div
								key={`${file.name}-${file.size}-${file.lastModified}`}
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 transition-colors hover:bg-(--desktop-surface-soft-hover)"
							>
								<div className="aspect-square bg-white/5 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
									{isImage ? (
										<img
											src={URL.createObjectURL(file)}
											alt={file.name}
											className="w-full h-full object-cover"
											onLoad={(e) =>
												URL.revokeObjectURL((e.target as HTMLImageElement).src)
											}
										/>
									) : (
										<div
											className={`p-4 bg-${format.color}-500/20 rounded-lg border border-${format.color}-400/30`}
										>
											<Icon
												width={32}
												height={32}
												className={`text-${format.color}-300`}
											/>
										</div>
									)}
									{format.isWord && (
										<div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
											<DocumentTextIcon
												width={12}
												height={12}
												className="text-white"
											/>
										</div>
									)}
								</div>

								<div className="space-y-1">
									<div
										className="truncate text-sm font-medium text-(--desktop-text-primary)"
										title={file.name}
									>
										{file.name}
									</div>
									<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{formatFileSize(file.size)}
									</div>
									<div className="text-xs text-(--desktop-text-dim)">
										{getFormatLabel(file.name, resolveFormatLabel(format))}
									</div>
									<div className="flex flex-wrap gap-1 mt-1">
										{getFilePriority(file.name) <= 2 && (
											<div className="inline-flex items-center px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-sm">
												{t('panels.import.priorityBadge')}
											</div>
										)}
										{getExtensionMismatchBadge(file.name)}
									</div>
								</div>

								<button
									type="button"
									onClick={() => onRemoveFile(index)}
									className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white/60 transition-colors hover:bg-red-500/50 hover:text-white"
									title={t('panels.import.removeFileTitle')}
								>
									<XMarkIcon width={12} height={12} />
								</button>
							</motion.div>
						);
					})}
				</div>
			) : (
				<div className="space-y-2">
					{files.map((file, index) => {
						const format = getFileIcon(file.name);
						const Icon = format.icon;

						return (
							<motion.div
								key={`${file.name}-${file.size}-${file.lastModified}`}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								className="flex items-center gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2 sm:gap-3 sm:p-3"
							>
								<div
									className={`p-1.5 sm:p-2 bg-${format.color}-500/20 rounded-lg border border-${format.color}-400/30 relative`}
								>
									<Icon
										width={14}
										height={14}
										className={`text-${format.color}-300 sm:size-16`}
									/>
									{format.isWord && (
										<div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
											<span className="text-[8px] font-bold text-white">W</span>
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
										{file.name}
									</div>
									<div className="flex items-center gap-2 text-xs text-(--desktop-text-dim)">
										<span>{formatFileSize(file.size)}</span>
										{getFilePriority(file.name) <= 2 && (
											<span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-sm">
												{t('panels.import.priorityBadge')}
											</span>
										)}
										{getExtensionMismatchSpan(file.name)}
									</div>
									<div className="mt-0.5 text-xs text-(--desktop-text-dim)">
										{getProcessingMethodForFile(file.name)}
									</div>
								</div>
								<DesktopAppButton
									onClick={() => onRemoveFile(index)}
									variant="ghost"
									size="icon"
									title={t('panels.import.removeFileTitle')}
								>
									<XMarkIcon width={16} height={16} />
								</DesktopAppButton>
							</motion.div>
						);
					})}
				</div>
			)}
		</div>
	);
}
