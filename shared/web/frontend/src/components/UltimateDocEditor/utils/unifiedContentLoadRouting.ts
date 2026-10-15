/**
 * Как интерпретировать скачанное тело unified content при открытии в Doc Editor.
 */
export type UnifiedLoadBodyKind =
	| 'plain_paragraphs'
	| 'markdown_to_html'
	| 'html_as_is'
	| 'office_to_html'
	| 'unsupported';

const OFFICE_WORD_EXT = /\.(docx?|odt|rtf)$/i;

const OFFICE_WORD_MIMES = new Set([
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.oasis.opendocument.text',
	'application/rtf',
	'text/rtf',
]);

/** Word-processor binaries opened in Doc Editor — require Stack4 convert/upload. */
export function isUnifiedOfficeDocumentFormat(
	fileData: UnifiedContentFileMeta
): boolean {
	const storageName = resolvedUnifiedContentStorageName(fileData);
	const mime = (fileData.mime_type ?? '').toLowerCase().trim();
	if (OFFICE_WORD_EXT.test(storageName)) {
		return true;
	}
	return OFFICE_WORD_MIMES.has(mime);
}

export type UnifiedContentFileMeta = {
	content_type?: string;
	mime_type?: string;
	name?: string;
	/** Реальное имя файла с расширением; `name` часто заголовок без `.md` */
	original_filename?: string | null;
};

/** Имя для типа файла и сохранения: сначала original_filename, иначе name. */
export function resolvedUnifiedContentStorageName(
	meta: UnifiedContentFileMeta
): string {
	const o = meta.original_filename?.trim();
	if (o) {
		return o;
	}
	const n = meta.name?.trim();
	if (n) {
		return n;
	}
	return 'document.html';
}

/** Начало похоже на HTML-документ/фрагмент, а не на Markdown. */
export function unifiedDownloadBodyLooksLikeHtml(bodyText: string): boolean {
	const t = bodyText.trim();
	if (!t.startsWith('<')) {
		return false;
	}
	return /<\s*[a-z!?]/i.test(t.slice(0, 120));
}

/** Имя файла — markdown (по расширению или MIME). */
export function isUnifiedMarkdownStorage(
	fileData: UnifiedContentFileMeta
): boolean {
	const storageName = resolvedUnifiedContentStorageName(fileData);
	const mime = (fileData.mime_type ?? '').toLowerCase().trim();
	if (/\.(md|markdown)$/i.test(storageName)) {
		return true;
	}
	return mime === 'text/markdown' || mime === 'text/x-markdown';
}

export function resolveUnifiedLoadBodyKind(
	fileData: UnifiedContentFileMeta,
	bodyText: string
): UnifiedLoadBodyKind {
	if (isUnifiedOfficeDocumentFormat(fileData)) {
		return 'office_to_html';
	}

	const mime = fileData.mime_type ?? '';
	const ct = fileData.content_type ?? '';
	const storageName = resolvedUnifiedContentStorageName(fileData);
	const looksHtml = unifiedDownloadBodyLooksLikeHtml(bodyText);
	const isMarkdown = isUnifiedMarkdownStorage(fileData);

	// .md / text/markdown — до generic text/plain (иначе HTML/Markdown режется по \n)
	if (isMarkdown) {
		if (looksHtml) {
			return 'html_as_is';
		}
		return 'markdown_to_html';
	}

	if (ct === 'text/plain' || mime === 'text/plain') {
		return 'plain_paragraphs';
	}

	if (/\.(txt|text)$/i.test(storageName) && !looksHtml) {
		return 'plain_paragraphs';
	}

	if (ct === 'document' || mime === 'text/html' || looksHtml) {
		return 'html_as_is';
	}

	return 'unsupported';
}
