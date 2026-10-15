/**
 * Unified Content: что физически писать в хранилище при сохранении из Doc Editor.
 * Формат определяется по имени файла (и подсказке mime с GET): .md → Markdown, .txt → plain, .html → HTML, и т.д.
 */
import { htmlToMarkdown } from './htmlToMarkdown';

export type UnifiedEditorSavePayload = {
	/** Байты для replaceContentFile */
	bytes: string;
	/** MIME заголовок Blob/File */
	mime: string;
	/** HTML, который держим в редакторе после сохранения (всегда исходный HTML редактора) */
	logicalHtml: string;
};

function isMarkdownFileName(name: string): boolean {
	const lower = name.trim().toLowerCase();
	return lower.endsWith('.md') || lower.endsWith('.markdown');
}

function isHtmlFileName(name: string): boolean {
	const lower = name.trim().toLowerCase();
	return lower.endsWith('.html') || lower.endsWith('.htm');
}

function isPlainTextFileName(name: string): boolean {
	const lower = name.trim().toLowerCase();
	return lower.endsWith('.txt') || lower.endsWith('.text');
}

function storedMimeLooksMarkdown(mime: string | null | undefined): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	return m === 'text/markdown' || m === 'text/x-markdown';
}

function storedMimeLooksPlainText(mime: string | null | undefined): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	return m === 'text/plain' || m === 'text/x-plain';
}

function storedMimeLooksHtml(mime: string | null | undefined): boolean {
	const m = (mime ?? '').trim().toLowerCase();
	return m.startsWith('text/html') || m === 'application/xhtml+xml';
}

const _BREAK_TAG_RE = /<br\s*\/?>/gi;
const _PARAGRAPH_CLOSE_RE = /<\/p\s*>/gi;
const _TAG_RE = /<[^>]+>/g;

/** HTML редактора → plain text с переносами абзацев (без DOM в тестах). */
export function htmlToPlainTextForUnifiedSave(html: string): string {
	const raw = html ?? '';
	if (!raw.trim()) {
		return '';
	}
	let text = raw
		.replace(_BREAK_TAG_RE, '\n')
		.replace(_PARAGRAPH_CLOSE_RE, '\n\n')
		.replace(_TAG_RE, '');
	text = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n');
	text = text
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
	const out = text.trimEnd();
	if (!out) {
		return '';
	}
	return out.endsWith('\n') ? out : `${out}\n`;
}

export function buildUnifiedEditorSavePayload(
	editorHtml: string,
	fileName: string,
	options?: { storedMimeType?: string | null }
): UnifiedEditorSavePayload {
	const logicalHtml = editorHtml ?? '';
	const mimeHint = options?.storedMimeType;

	const treatAsMarkdown =
		isMarkdownFileName(fileName) || storedMimeLooksMarkdown(mimeHint);
	if (treatAsMarkdown) {
		const md = htmlToMarkdown(logicalHtml);
		if (!md.trim() && logicalHtml.includes('<')) {
			return {
				bytes: logicalHtml,
				mime: 'text/html;charset=utf-8',
				logicalHtml,
			};
		}
		return {
			bytes: md.endsWith('\n') ? md : `${md}\n`,
			mime: 'text/markdown;charset=utf-8',
			logicalHtml,
		};
	}

	if (isHtmlFileName(fileName) || storedMimeLooksHtml(mimeHint)) {
		return {
			bytes: logicalHtml,
			mime: 'text/html;charset=utf-8',
			logicalHtml,
		};
	}

	const treatAsPlain =
		isPlainTextFileName(fileName) ||
		(storedMimeLooksPlainText(mimeHint) && !isHtmlFileName(fileName));
	if (treatAsPlain) {
		const plain = htmlToPlainTextForUnifiedSave(logicalHtml);
		return {
			bytes: plain,
			mime: 'text/plain;charset=utf-8',
			logicalHtml,
		};
	}

	return {
		bytes: logicalHtml,
		mime: 'text/html;charset=utf-8',
		logicalHtml,
	};
}
