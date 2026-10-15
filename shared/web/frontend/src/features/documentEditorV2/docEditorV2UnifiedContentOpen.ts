/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Load unified Content Manager files into Document Editor V2 by downloading the blob
 * and applying the same body routing rules as the legacy UltimateDocEditor.
 *
 * Invariants:
 * - Opening from Content Manager must hydrate editor body from `/content/{id}/download`, not only v2 metadata.
 * - Office binaries never pass through `Blob.text()`; they use the Stack4 convert path.
 *
 * Related:
 * - src/features/documentEditorV2/DocEditorV2.tsx
 * - src/components/UltimateDocEditor/hooks/useDocumentFileExchange.ts
 */

import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';
import { convertUploadedFileViaDocEditor } from '@/components/UltimateDocEditor/utils/convertUploadedFileViaDocEditor';
import { prepareOfficeHtmlForTipTap } from '@/components/UltimateDocEditor/utils/prepareOfficeHtmlForTipTap';
import { renderMarkdownToHTML } from '@/components/UltimateDocEditor/utils/renderMarkdownToHtml';
import {
	isUnifiedOfficeDocumentFormat,
	resolveUnifiedLoadBodyKind,
	resolvedUnifiedContentStorageName,
	type UnifiedContentFileMeta,
} from '@/components/UltimateDocEditor/utils/unifiedContentLoadRouting';
import { apiClient } from '@/services/api';
import { htmlToPlainText } from './docEditorV2State';

export interface DocEditorV2UnifiedContentLoadResult {
	title: string;
	contentHtml: string;
	plainText: string;
	storageFileName: string;
	parseWarnings: string[];
}

type UnifiedContentMetadataResponse = {
	name?: string;
	title?: string;
	original_filename?: string | null;
	file_size?: number;
	content_type?: string;
	mime_type?: string;
};

function resolvedTitle(
	metadata: UnifiedContentMetadataResponse,
	fallbackTitle: string
): string {
	const title =
		metadata.title?.trim() || metadata.name?.trim() || fallbackTitle.trim();
	return title || fallbackTitle;
}

async function bodyTextToEditorHtml(
	fileMeta: UnifiedContentFileMeta,
	blob: Blob,
	storageFileName: string,
	mimeType?: string
): Promise<{ contentHtml: string; parseWarnings: string[] }> {
	if (isUnifiedOfficeDocumentFormat(fileMeta)) {
		try {
			const htmlContent = await convertUploadedFileViaDocEditor(
				blob,
				storageFileName,
				'html',
				mimeType
			);
			return {
				contentHtml: sanitizeUserHtml(prepareOfficeHtmlForTipTap(htmlContent)),
				parseWarnings: [],
			};
		} catch {
			return {
				contentHtml:
					'<p>Не удалось преобразовать документ Word/ODT. Проверьте доступность stack4 (Tika) или скачайте файл.</p>',
				parseWarnings: ['office_convert_failed'],
			};
		}
	}

	const bodyText = await blob.text();
	const loadKind = resolveUnifiedLoadBodyKind(fileMeta, bodyText);
	let contentHtml = bodyText;
	const parseWarnings: string[] = [];

	if (loadKind === 'plain_paragraphs') {
		contentHtml = `<p>${bodyText.replace(/\n/g, '</p><p>')}</p>`;
	} else if (loadKind === 'markdown_to_html') {
		contentHtml = renderMarkdownToHTML(bodyText);
	} else if (loadKind === 'html_as_is') {
		if (!bodyText.trim().startsWith('<')) {
			contentHtml = `<p>${bodyText}</p>`;
		}
	} else {
		contentHtml =
			'<p>Неподдерживаемый формат файла. Редактор поддерживает HTML, текст и Word (doc/docx/odt/rtf).</p>';
		parseWarnings.push('unsupported_format');
	}

	return {
		contentHtml: sanitizeUserHtml(prepareOfficeHtmlForTipTap(contentHtml)),
		parseWarnings,
	};
}

export async function loadUnifiedContentForDocEditorV2(
	unifiedContentId: string,
	options?: { signal?: AbortSignal; fallbackTitle?: string }
): Promise<DocEditorV2UnifiedContentLoadResult> {
	const normalizedId = unifiedContentId.trim();
	if (!normalizedId) {
		throw new Error('Unified content id is required');
	}
	const fallbackTitle = options?.fallbackTitle?.trim() || 'Документ';

	const metadataResponse = await apiClient.get<UnifiedContentMetadataResponse>(
		`/api/v1/content/${normalizedId}`,
		{ signal: options?.signal }
	);
	const metadata = metadataResponse.data;
	const fileMeta: UnifiedContentFileMeta = {
		content_type: metadata.content_type,
		mime_type: metadata.mime_type,
		name: metadata.name,
		original_filename: metadata.original_filename,
	};
	const storageFileName = resolvedUnifiedContentStorageName(fileMeta);
	const title = resolvedTitle(metadata, fallbackTitle);

	const downloadResponse = await apiClient.get<Blob>(
		`/api/v1/content/${normalizedId}/download`,
		{
			responseType: 'blob',
			signal: options?.signal,
		}
	);
	const { contentHtml, parseWarnings } = await bodyTextToEditorHtml(
		fileMeta,
		downloadResponse.data,
		storageFileName,
		metadata.mime_type
	);

	return {
		title,
		contentHtml,
		plainText: htmlToPlainText(contentHtml),
		storageFileName,
		parseWarnings,
	};
}

export function hasSubstantiveDocEditorV2Body(params: {
	plainText?: string | null;
	contentHtml?: string | null;
	contentMarkdown?: string | null;
}): boolean {
	const plain = params.plainText?.trim() ?? '';
	if (plain.length > 0) {
		return true;
	}
	const html = params.contentHtml?.trim() ?? '';
	if (html.replace(/<[^>]+>/g, '').trim().length > 0) {
		return true;
	}
	const markdown = params.contentMarkdown?.trim() ?? '';
	return markdown.length > 0;
}
