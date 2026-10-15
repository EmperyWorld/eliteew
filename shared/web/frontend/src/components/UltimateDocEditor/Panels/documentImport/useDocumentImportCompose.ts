/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes DocumentImportPanel state, format helpers, dropzone, and batch import.
 *
 * Invariants:
 * - Escape closes the panel when open.
 * - Panel shell consumes this hook as a single `c` object.
 *
 * Related:
 * - DocumentImportPanel.tsx, useDocumentImportDropzone.ts, useDocumentImportBatch.ts
 */

import {
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useNotifications } from '@/notifications';
import type {
	DocumentImportResult,
	ImportProgress,
} from '@/components/UltimateDocEditor/types/editor.types';
import { useEditorStoreShallow } from '@/components/UltimateDocEditor/store/editorStoreContext';
import { selectDocumentImportPanelSlice } from '@/components/UltimateDocEditor/store/editorStoreSelectors';
import type {
	DocumentImportPanelProps,
	FileFormatDetection,
} from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';
import { useDocumentImportBatch } from '@/components/UltimateDocEditor/Panels/documentImport/useDocumentImportBatch';
import { useDocumentImportDropzone } from '@/components/UltimateDocEditor/Panels/documentImport/useDocumentImportDropzone';
import { useDocumentImportFormatHelpers } from '@/components/UltimateDocEditor/Panels/documentImport/useDocumentImportFormatHelpers';

export function useDocumentImportCompose({
	isOpen,
	onClose,
	onImportComplete,
}: DocumentImportPanelProps) {
	const { t } = useTranslation('docEditorPanels');
	const { importDocument, isLoading } = useEditorStoreShallow(
		selectDocumentImportPanelSlice
	);
	const { success, error: showError, info } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();

	const [files, setFiles] = useState<File[]>([]);
	const [importResults, setImportResults] = useState<DocumentImportResult[]>(
		[]
	);
	const [progress, setProgress] = useState<ImportProgress | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [dropZoneError, setDropZoneError] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [fileFormats, setFileFormats] = useState<
		Map<string, FileFormatDetection>
	>(new Map());

	const fileInputRef = useRef<HTMLInputElement>(null);

	const formatHelpers = useDocumentImportFormatHelpers(t, fileFormats);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose]);

	const dropzone = useDocumentImportDropzone({
		t,
		fileFormats,
		setFileFormats,
		setFiles,
		setIsDragOver,
		setDropZoneError,
		showError,
		info,
	});

	const { importFiles } = useDocumentImportBatch({
		t,
		files,
		setFiles,
		setProgress,
		setImportResults,
		getFilePriority: formatHelpers.getFilePriority,
		getProcessingMethod: formatHelpers.getProcessingMethod,
		importDocument,
		success,
		showError,
		onImportComplete,
	});

	const removeFile = (index: number): void => {
		const fileToRemove = files[index];
		if (fileToRemove) {
			setFileFormats((prev) => {
				const newFormats = new Map(prev);
				newFormats.delete(fileToRemove.name);
				return newFormats;
			});
		}
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const clearAllFiles = (): void => {
		setFiles([]);
		setImportResults([]);
		setProgress(null);
		setShowPreview(false);
		setFileFormats(new Map());
	};

	const togglePreview = (): void => {
		setShowPreview(!showPreview);
	};

	const openFilePicker = (): void => {
		setDropZoneError(false);
		fileInputRef.current?.click();
	};

	return {
		t,
		isOpen,
		onClose,
		docSidePanelZ,
		isLoading,
		files,
		importResults,
		progress,
		isDragOver,
		dropZoneError,
		showPreview,
		fileInputRef,
		setDropZoneError: setDropZoneError as Dispatch<SetStateAction<boolean>>,
		...formatHelpers,
		...dropzone,
		importFiles,
		removeFile,
		clearAllFiles,
		togglePreview,
		openFilePicker,
	};
}

export type DocumentImportCompose = ReturnType<typeof useDocumentImportCompose>;
