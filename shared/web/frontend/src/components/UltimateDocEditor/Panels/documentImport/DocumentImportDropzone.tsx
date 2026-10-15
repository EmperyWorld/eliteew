/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dropzone + hidden multi-file input for DocumentImportPanel.
 *
 * Invariants:
 * - Accept list matches SUPPORTED_FORMATS extensions.
 *
 * Related:
 * - useDocumentImportDropzone.ts, DocumentImportPanel.tsx
 */

import type { ChangeEvent, DragEvent, KeyboardEvent, RefObject } from 'react';
import type { TFunction } from 'i18next';
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

import { DesktopAppStatusBadge } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { SUPPORTED_FORMATS } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';

type DocumentImportDropzoneProps = {
	t: TFunction<'docEditorPanels'>;
	isDragOver: boolean;
	dropZoneError: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	onDragOver: (e: DragEvent) => void;
	onDragLeave: (e: DragEvent) => void;
	onDrop: (e: DragEvent) => void;
	onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
	onOpenPicker: () => void;
};

export function DocumentImportDropzone({
	t,
	isDragOver,
	dropZoneError,
	fileInputRef,
	onDragOver,
	onDragLeave,
	onDrop,
	onFileSelect,
	onOpenPicker,
}: DocumentImportDropzoneProps) {
	return (
		<div className="shrink-0 border-b border-(--desktop-border-subtle) p-5">
			{/* biome-ignore lint/a11y/useSemanticElements: Drop zone includes headings and format chips; not a compact text button */}
			<div
				role="button"
				tabIndex={0}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				className={cn(
					'relative cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-[border-color,background-color,box-shadow] duration-150 sm:p-6 md:p-8',
					'border-(--desktop-border-subtle) bg-(--desktop-surface-app)/60 hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft)',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)',
					isDragOver &&
						'border-blue-400/90 bg-blue-500/15 shadow-[inset_0_0_0_1px_color-mix(in_srgb,rgb(96_165_250)_35%,transparent)]',
					dropZoneError &&
						!isDragOver &&
						'border-red-400/55 bg-red-500/[0.07] hover:border-red-400/70'
				)}
				onClick={onOpenPicker}
				onKeyDown={(e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onOpenPicker();
					}
				}}
				aria-label={t('panels.import.dropZoneAria')}
				aria-invalid={dropZoneError}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept=".doc,.docx,.pdf,.txt,.md,.html,.rtf,.odt,.png,.jpg,.jpeg"
					onChange={onFileSelect}
					className="hidden"
					{...({ webkitdirectory: '' } as { webkitdirectory?: string })}
				/>

				<ArrowUpTrayIcon
					className="mx-auto mb-3 size-8 text-(--desktop-text-muted) sm:mb-4 sm:size-10"
					aria-hidden
				/>
				<h4 className="mb-2 flex flex-wrap items-center justify-center gap-2 text-base font-semibold text-(--desktop-text-primary) sm:text-lg">
					{dropZoneError && !isDragOver ? (
						<span className="text-red-200">
							{t('panels.import.dropHeadingInvalid')}
						</span>
					) : isDragOver ? (
						<span className="text-blue-200">
							{t('panels.import.dropHeadingRelease')}
						</span>
					) : (
						<span>{t('panels.import.dropHeadingDefault')}</span>
					)}
					<DesktopAppStatusBadge className="border-blue-400/30 bg-blue-500/20 text-blue-300">
						{t('panels.import.wordDocBadge')}
					</DesktopAppStatusBadge>
				</h4>
				<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-3 sm:mb-4 sm:text-sm')}>
					{dropZoneError && !isDragOver
						? t('panels.import.dropHintInvalid')
						: isDragOver
							? t('panels.import.dropHintRelease')
							: t('panels.import.dropHintDefault')}
				</p>
				<div className="flex flex-wrap justify-center gap-1 text-xs text-(--desktop-text-dim) sm:gap-2">
					{SUPPORTED_FORMATS.map((format) => (
						<span
							key={format.ext}
							className={`px-2 py-1 rounded flex items-center gap-1 ${
								format.isWord
									? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
									: 'bg-white/10'
							}`}
						>
							{format.isWord && <DocumentTextIcon width={10} height={10} />}
							{format.ext}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}
