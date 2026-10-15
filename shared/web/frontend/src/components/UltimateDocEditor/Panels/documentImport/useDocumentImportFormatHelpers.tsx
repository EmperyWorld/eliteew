/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Format-label / icon / priority helpers for DocumentImportPanel file rows.
 *
 * Invariants:
 * - Extension-mismatch UI only when confidence > 0.7 and formats differ.
 *
 * Related:
 * - useDocumentImportCompose.ts, DocumentImportFileList.tsx
 */

import { useCallback, type ReactNode } from 'react';
import type { TFunction } from 'i18next';

import {
	SUPPORTED_FORMATS,
	type FileFormatDetection,
	type ImportSupportedFormat,
} from '@/components/UltimateDocEditor/Panels/documentImport/documentImportTypes';

export function useDocumentImportFormatHelpers(
	t: TFunction<'docEditorPanels'>,
	fileFormats: Map<string, FileFormatDetection>
) {
	const formatFileSize = useCallback(
		(bytes: number): string => {
			if (bytes === 0) {
				return t('panels.import.size.bytesZero');
			}
			const k = 1024;
			const sizes = [
				t('panels.import.size.bytes'),
				t('panels.import.size.kb'),
				t('panels.import.size.mb'),
				t('panels.import.size.gb'),
			];
			const i = Math.min(
				Math.floor(Math.log(bytes) / Math.log(k)),
				sizes.length - 1
			);
			return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
		},
		[t]
	);

	const getProcessingMethod = useCallback(
		(fileName: string): string => {
			const ext = fileName.toLowerCase().split('.').pop();
			const mapKey =
				ext === 'doc' ||
				ext === 'docx' ||
				ext === 'pdf' ||
				ext === 'rtf' ||
				ext === 'odt' ||
				ext === 'txt' ||
				ext === 'md' ||
				ext === 'html'
					? ext
					: 'default';
			return t(`panels.import.processing.${mapKey}`);
		},
		[t]
	);

	const resolveFormatLabel = useCallback(
		(format: ImportSupportedFormat): string =>
			t(`panels.import.formatLabels.${format.labelKey}`),
		[t]
	);

	const getFileIcon = useCallback((fileName: string): ImportSupportedFormat => {
		const ext = fileName.toLowerCase().split('.').pop();
		const format = SUPPORTED_FORMATS.find((f) => f.ext === `.${ext}`);
		return format ?? SUPPORTED_FORMATS[0];
	}, []);

	const getFilePriority = useCallback((fileName: string): number => {
		const ext = fileName.toLowerCase().split('.').pop();
		const format = SUPPORTED_FORMATS.find((f) => f.ext === `.${ext}`);
		return format?.priority ?? 99;
	}, []);

	const getFormatLabel = useCallback(
		(fileName: string, formatLabel: string): string => {
			const formatInfo = fileFormats.get(fileName);
			if (
				formatInfo?.detectedFormat &&
				formatInfo.detectedFormat !== formatInfo.extension
			) {
				return t('panels.import.formatWithDetection', {
					label: formatLabel,
					format: formatInfo.detectedFormat.toUpperCase(),
				});
			}
			return formatLabel;
		},
		[fileFormats, t]
	);

	const getExtensionMismatchBadge = useCallback(
		(fileName: string): ReactNode => {
			const formatInfo = fileFormats.get(fileName);
			if (
				formatInfo?.detectedFormat &&
				formatInfo.detectedFormat !== formatInfo.extension &&
				formatInfo.confidence > 0.7
			) {
				return (
					<div className="inline-flex items-center px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-sm">
						{t('panels.import.extensionMismatchBadge')}
					</div>
				);
			}
			return null;
		},
		[fileFormats, t]
	);

	const getExtensionMismatchSpan = useCallback(
		(fileName: string): ReactNode => {
			const formatInfo = fileFormats.get(fileName);
			if (
				formatInfo?.detectedFormat &&
				formatInfo.detectedFormat !== formatInfo.extension &&
				formatInfo.confidence > 0.7
			) {
				return (
					<span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-sm">
						{t('panels.import.detectedAs', {
							format: formatInfo.detectedFormat.toUpperCase(),
						})}
					</span>
				);
			}
			return null;
		},
		[fileFormats, t]
	);

	const getProcessingMethodForFile = useCallback(
		(fileName: string): string => {
			const formatInfo = fileFormats.get(fileName);
			if (
				formatInfo?.detectedFormat &&
				formatInfo.detectedFormat !== formatInfo.extension
			) {
				return getProcessingMethod(
					fileName.replace(/\.[^.]+$/, `.${formatInfo.detectedFormat}`)
				);
			}
			return getProcessingMethod(fileName);
		},
		[fileFormats, getProcessingMethod]
	);

	return {
		formatFileSize,
		getProcessingMethod,
		resolveFormatLabel,
		getFileIcon,
		getFilePriority,
		getFormatLabel,
		getExtensionMismatchBadge,
		getExtensionMismatchSpan,
		getProcessingMethodForFile,
	};
}
