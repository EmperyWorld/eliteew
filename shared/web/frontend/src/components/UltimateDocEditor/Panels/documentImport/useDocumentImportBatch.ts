/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Batch import pipeline (priority sort, progress, OCR/legacy DOC path) for DocumentImportPanel.
 *
 * Invariants:
 * - DOC files call importDocument with enhanceLegacyDoc: true.
 * - Progress clears 3s after completion; onImportComplete receives full results.
 *
 * Related:
 * - importPayloadMappers.ts, useDocumentImportCompose.ts
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { TFunction } from 'i18next';

import type {
	DocumentImportResult,
	ImportProgress,
} from '@/components/UltimateDocEditor/types/editor.types';
import type { ImportDocumentApiPayload } from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';
import { importPayloadToUltimateDocument } from '@/components/UltimateDocEditor/Panels/documentImport/importPayloadMappers';

type NotifyFn = (title: string, body: string) => void;

type ImportDocumentFn = (
	file: File,
	options?: { enhanceLegacyDoc?: boolean }
) => Promise<unknown>;

type UseDocumentImportBatchArgs = {
	t: TFunction<'docEditorPanels'>;
	files: File[];
	setFiles: Dispatch<SetStateAction<File[]>>;
	setProgress: Dispatch<SetStateAction<ImportProgress | null>>;
	setImportResults: Dispatch<SetStateAction<DocumentImportResult[]>>;
	getFilePriority: (fileName: string) => number;
	getProcessingMethod: (fileName: string) => string;
	importDocument: ImportDocumentFn;
	success: NotifyFn;
	showError: NotifyFn;
	onImportComplete?: (results: DocumentImportResult[]) => void | Promise<void>;
};

export function useDocumentImportBatch({
	t,
	files,
	setFiles,
	setProgress,
	setImportResults,
	getFilePriority,
	getProcessingMethod,
	importDocument,
	success,
	showError,
	onImportComplete,
}: UseDocumentImportBatchArgs) {
	const importFiles = useCallback(async (): Promise<void> => {
		if (files.length === 0) {
			return;
		}

		const sortedFiles = [...files].sort(
			(a, b) => getFilePriority(a.name) - getFilePriority(b.name)
		);

		setProgress({
			current: 0,
			total: sortedFiles.length,
			status: t('panels.import.progress.starting'),
		});
		const results: DocumentImportResult[] = [];

		for (let i = 0; i < sortedFiles.length; i++) {
			const file = sortedFiles[i];
			if (!file) {
				continue;
			}
			const processingMethod = getProcessingMethod(file.name);

			setProgress({
				current: i + 1,
				total: sortedFiles.length,
				status: t('panels.import.progress.processingFile', { name: file.name }),
				fileName: file.name,
				method: processingMethod,
			});

			try {
				const ext = file.name.toLowerCase().split('.').pop();
				let payload: ImportDocumentApiPayload;

				if (ext === 'doc') {
					setProgress({
						current: i + 1,
						total: sortedFiles.length,
						status: t('panels.import.progress.convertingDoc'),
						fileName: file.name,
						method: processingMethod,
					});

					await new Promise((resolve) => setTimeout(resolve, 500));

					payload = (await importDocument(file, {
						enhanceLegacyDoc: true,
					})) as ImportDocumentApiPayload;
				} else if (ext === 'docx') {
					setProgress({
						current: i + 1,
						total: sortedFiles.length,
						status: t('panels.import.progress.processingDocx'),
						fileName: file.name,
						method: processingMethod,
					});

					payload = (await importDocument(file)) as ImportDocumentApiPayload;
				} else {
					payload = (await importDocument(file)) as ImportDocumentApiPayload;
				}

				const document = importPayloadToUltimateDocument(payload);
				results.push({
					fileName: file.name,
					success: true,
					document,
					extractedText: payload.content,
					metadata: {
						wordCount: payload.word_count,
						charCount: payload.character_count,
						mimeType: payload.mime_type,
						processingMethod: processingMethod,
						formatVersion: ext === 'doc' ? 'legacy' : 'modern',
					},
				});
			} catch (err: unknown) {
				const errorMessage =
					err instanceof Error
						? err.message
						: t('panels.import.errors.importFailedFallback');
				results.push({
					fileName: file.name,
					success: false,
					error: errorMessage,
					metadata: {
						wordCount: 0,
						charCount: 0,
						mimeType: file.type || 'application/octet-stream',
						processingMethod: processingMethod,
					},
				});
			}
		}

		setProgress({
			current: files.length,
			total: files.length,
			status: t('panels.import.progress.complete'),
		});
		setImportResults(results);
		setFiles([]);

		const successCount = results.filter((r) => r.success).length;
		const failCount = results.length - successCount;
		const wordDocsCount = results.filter(
			(r) =>
				r.success &&
				(r.fileName.toLowerCase().endsWith('.doc') ||
					r.fileName.toLowerCase().endsWith('.docx'))
		).length;

		if (successCount > 0) {
			const message =
				wordDocsCount > 0
					? t('panels.import.toast.successBodyWord', {
							count: successCount,
							wordCount: wordDocsCount,
						})
					: t('panels.import.toast.successBody', { count: successCount });
			success(t('panels.import.toast.successTitle'), message);
		}
		if (failCount > 0) {
			showError(
				t('panels.import.toast.issuesTitle'),
				t('panels.import.toast.issuesBody', { count: failCount })
			);
		}

		if (onImportComplete) {
			await onImportComplete(results);
		}

		setTimeout(() => setProgress(null), 3000);
	}, [
		t,
		files,
		setFiles,
		setProgress,
		setImportResults,
		getFilePriority,
		getProcessingMethod,
		importDocument,
		success,
		showError,
		onImportComplete,
	]);

	return { importFiles };
}
