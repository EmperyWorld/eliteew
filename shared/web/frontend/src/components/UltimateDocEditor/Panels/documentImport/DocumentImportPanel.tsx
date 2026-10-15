/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DocumentImportPanel shell; delegates state to documentImport/* hooks and UI modules.
 *
 * Invariants:
 * - Named export `DocumentImportPanel` for lazy import from UltimateDocEditorPanelOverlays.
 * - Public props/behavior unchanged vs pre-atomization monolith.
 *
 * Related:
 * - ../DocumentImportPanel.tsx (facade re-export)
 * - useDocumentImportCompose.ts
 */

import * as React from 'react';
import { motion } from 'framer-motion';

import { DocumentImportActions } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportActions';
import { DocumentImportDropzone } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportDropzone';
import { DocumentImportFileList } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportFileList';
import { DocumentImportHeader } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportHeader';
import { DocumentImportProgress } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportProgress';
import { DocumentImportResults } from '@/components/UltimateDocEditor/Panels/documentImport/DocumentImportResults';
import type { DocumentImportPanelProps } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';
import { useDocumentImportCompose } from '@/components/UltimateDocEditor/Panels/documentImport/useDocumentImportCompose';

export const DocumentImportPanel: React.FC<DocumentImportPanelProps> = (
	props
) => {
	const { isOpen } = props;
	const c = useDocumentImportCompose(props);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="document-import-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
			className="document-import-panel fixed bottom-0 right-0 top-0 flex w-full max-w-sm min-h-0 flex-col overflow-hidden border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl sm:max-w-md md:w-[500px]"
			style={{ zIndex: c.docSidePanelZ }}
		>
			<DocumentImportHeader t={c.t} onClose={c.onClose} />

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<DocumentImportDropzone
					t={c.t}
					isDragOver={c.isDragOver}
					dropZoneError={c.dropZoneError}
					fileInputRef={c.fileInputRef}
					onDragOver={c.handleDragOver}
					onDragLeave={c.handleDragLeave}
					onDrop={(e) => void c.handleDrop(e)}
					onFileSelect={(e) => void c.handleFileSelect(e)}
					onOpenPicker={c.openFilePicker}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto">
					<DocumentImportFileList
						t={c.t}
						files={c.files}
						importResultsLength={c.importResults.length}
						showPreview={c.showPreview}
						onTogglePreview={c.togglePreview}
						onClearAll={c.clearAllFiles}
						onRemoveFile={c.removeFile}
						formatFileSize={c.formatFileSize}
						getFileIcon={c.getFileIcon}
						getFilePriority={c.getFilePriority}
						resolveFormatLabel={c.resolveFormatLabel}
						getFormatLabel={c.getFormatLabel}
						getExtensionMismatchBadge={c.getExtensionMismatchBadge}
						getExtensionMismatchSpan={c.getExtensionMismatchSpan}
						getProcessingMethodForFile={c.getProcessingMethodForFile}
					/>

					<DocumentImportProgress t={c.t} progress={c.progress} />

					<DocumentImportResults t={c.t} importResults={c.importResults} />
				</div>

				<DocumentImportActions
					t={c.t}
					filesCount={c.files.length}
					isLoading={c.isLoading}
					progress={c.progress}
					onImport={() => void c.importFiles()}
				/>
			</div>
		</motion.div>
	);
};
