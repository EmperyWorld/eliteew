/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Drag/drop + file-picker ingestion for DocumentImportPanel (including folders).
 *
 * Invariants:
 * - Supported by extension OR magic-byte detection via SUPPORTED_EXTENSIONS.
 * - Resets file input value after select so the same files can be re-chosen.
 *
 * Related:
 * - detectFileFormat.ts, useDocumentImportCompose.ts
 */

import * as React from 'react';
import { useCallback } from 'react';
import type { TFunction } from 'i18next';

import { detectFileFormat } from '@/components/UltimateDocEditor/Panels/documentImport/detectFileFormat';
import {
	SUPPORTED_EXTENSIONS,
	type FileFormatDetection,
} from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';
import { isFileSystemDirectoryEntry } from '@/components/UltimateDocEditor/Panels/documentImport/importPayloadMappers';

type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

function isSupportedExtension(
	value: string | null | undefined
): value is SupportedExtension {
	return (
		typeof value === 'string' &&
		(SUPPORTED_EXTENSIONS as readonly string[]).includes(value)
	);
}

type NotifyFn = (title: string, body: string) => void;

type UseDocumentImportDropzoneArgs = {
	t: TFunction<'docEditorPanels'>;
	fileFormats: Map<string, FileFormatDetection>;
	setFileFormats: React.Dispatch<
		React.SetStateAction<Map<string, FileFormatDetection>>
	>;
	setFiles: React.Dispatch<React.SetStateAction<File[]>>;
	setIsDragOver: React.Dispatch<React.SetStateAction<boolean>>;
	setDropZoneError: React.Dispatch<React.SetStateAction<boolean>>;
	showError: NotifyFn;
	info: NotifyFn;
};

export function useDocumentImportDropzone({
	t,
	fileFormats,
	setFileFormats,
	setFiles,
	setIsDragOver,
	setDropZoneError,
	showError,
	info,
}: UseDocumentImportDropzoneArgs) {
	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDropZoneError(false);
			setIsDragOver(true);
		},
		[setDropZoneError, setIsDragOver]
	);

	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
		},
		[setIsDragOver]
	);

	const processDroppedItems = useCallback(
		async (items: DataTransferItemList): Promise<File[]> => {
			const validFiles: File[] = [];
			const newFormats = new Map(fileFormats);

			const processDirectoryEntry = async (
				dirEntry: FileSystemDirectoryEntry
			): Promise<void> => {
				const entries = await new Promise<FileSystemEntry[]>((resolve) => {
					const results: FileSystemEntry[] = [];
					const dirReader = dirEntry.createReader();
					const readEntries = (): void => {
						dirReader.readEntries((batch: FileSystemEntry[]) => {
							if (batch.length > 0) {
								results.push(...batch);
								readEntries();
							} else {
								resolve(results);
							}
						});
					};
					readEntries();
				});

				for (const entry of entries) {
					if (entry.isFile) {
						const fileEntry = entry as FileSystemFileEntry;
						const file = await new Promise<File>((resolve, reject) => {
							fileEntry.file(resolve, reject);
						});
						const ext = file.name.toLowerCase().split('.').pop();
						const formatDetection = await detectFileFormat(file);

						const isSupportedByExtension = isSupportedExtension(ext);
						const isSupportedByDetection = isSupportedExtension(
							formatDetection.detectedFormat
						);

						if (isSupportedByExtension || isSupportedByDetection) {
							newFormats.set(file.name, formatDetection);
							validFiles.push(file);
						}
					} else if (isFileSystemDirectoryEntry(entry)) {
						await processDirectoryEntry(entry);
					}
				}
			};

			const processItem = async (item: DataTransferItem): Promise<void> => {
				if (item.kind === 'file') {
					const file = item.getAsFile();
					if (file) {
						const ext = file.name.toLowerCase().split('.').pop();
						const formatDetection = await detectFileFormat(file);

						const isSupportedByExtension = isSupportedExtension(ext);
						const isSupportedByDetection = isSupportedExtension(
							formatDetection.detectedFormat
						);

						if (isSupportedByExtension || isSupportedByDetection) {
							newFormats.set(file.name, formatDetection);
							validFiles.push(file);
						}
					}
				} else if (item.kind === 'directory') {
					const dirEntry = item.webkitGetAsEntry?.();
					if (isFileSystemDirectoryEntry(dirEntry)) {
						await processDirectoryEntry(dirEntry);
					}
				}
			};

			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item) {
					await processItem(item);
				}
			}

			setFileFormats(newFormats);
			return validFiles;
		},
		[fileFormats, setFileFormats]
	);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			setDropZoneError(false);

			try {
				const validFiles = await processDroppedItems(e.dataTransfer.items);

				if (validFiles.length === 0) {
					setDropZoneError(true);
					showError(
						t('panels.import.errors.noValidTitle'),
						t('panels.import.errors.noValidBody')
					);
					return;
				}

				const totalItems = e.dataTransfer.items.length;
				const fileItems = Array.from(e.dataTransfer.items).filter(
					(item) => item.kind === 'file'
				).length;

				if (totalItems > fileItems) {
					info(
						t('panels.import.info.folderTitle'),
						t('panels.import.info.folderBody', {
							count: validFiles.length,
						})
					);
				}

				setFiles((prev) => [...prev, ...validFiles]);
			} catch {
				showError(
					t('panels.import.errors.dropFailedTitle'),
					t('panels.import.errors.dropFailedBody')
				);
			}
		},
		[
			processDroppedItems,
			showError,
			info,
			t,
			setFiles,
			setIsDragOver,
			setDropZoneError,
		]
	);

	const handleFileSelect = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFiles = Array.from(e.target.files || []);
			const validFiles: File[] = [];
			const extensionMismatches: string[] = [];
			const newFormats = new Map(fileFormats);

			for (const file of selectedFiles) {
				const ext = file.name.toLowerCase().split('.').pop();
				const formatDetection = await detectFileFormat(file);

				const isSupportedByExtension = isSupportedExtension(ext);
				const isSupportedByDetection = isSupportedExtension(
					formatDetection.detectedFormat
				);

				if (isSupportedByExtension || isSupportedByDetection) {
					newFormats.set(file.name, formatDetection);

					if (
						formatDetection.detectedFormat &&
						formatDetection.detectedFormat !== ext &&
						formatDetection.confidence > 0.7
					) {
						extensionMismatches.push(
							t('panels.import.info.mismatchListItem', {
								name: file.name,
								format: formatDetection.detectedFormat,
							})
						);
					}
					validFiles.push(file);
				}
			}

			setFileFormats(newFormats);
			if (validFiles.length > 0) {
				setDropZoneError(false);
			}

			if (validFiles.length !== selectedFiles.length) {
				const invalidCount = selectedFiles.length - validFiles.length;
				showError(
					t('panels.import.errors.unsupportedTitle'),
					t('panels.import.errors.unsupportedBody', { count: invalidCount })
				);
			}

			if (extensionMismatches.length > 0) {
				info(
					t('panels.import.info.extensionMismatchTitle'),
					t('panels.import.info.extensionMismatchBody', {
						list: extensionMismatches.join(', '),
					})
				);
			}

			if (validFiles.length > 0) {
				if (selectedFiles.length > validFiles.length) {
					info(
						t('panels.import.info.filesAddedTitle'),
						t('panels.import.info.filesAddedBody', {
							count: validFiles.length,
						})
					);
				}
				setFiles((prev) => [...prev, ...validFiles]);
			}

			e.target.value = '';
		},
		[
			showError,
			info,
			fileFormats,
			t,
			setFileFormats,
			setFiles,
			setDropZoneError,
		]
	);

	return {
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleFileSelect,
	};
}
