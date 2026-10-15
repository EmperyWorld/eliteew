/**
 * Heuristics for Content Manager text preview: raw HTML vs Markdown vs plain.
 */

/** True if body looks like an HTML fragment (e.g. pasted from Word / rich export). */
export function looksLikeHtmlFragment(text: string): boolean {
	const t = text.trim();
	if (t.length < 8) {
		return false;
	}
	const lower = t.toLowerCase();
	if (!lower.includes('<') || !lower.includes('>')) {
		return false;
	}
	if (lower.startsWith('<!doctype html') || lower.startsWith('<html')) {
		return true;
	}
	if (lower.startsWith('<?xml')) {
		return true;
	}
	if (
		/<\/p>/i.test(t) ||
		/<br\s*\/?>/i.test(t) ||
		/<\/div>/i.test(t) ||
		/<strong\b/i.test(t) ||
		/<em\b/i.test(t) ||
		/<h[1-6]\b/i.test(t) ||
		/<ul\b/i.test(t) ||
		/<ol\b/i.test(t) ||
		/<table\b/i.test(t)
	) {
		return /<[a-z][a-z0-9]*\b/i.test(t);
	}
	if (/^<[a-z][a-z0-9]*(\s[^>]*)?>/i.test(t) && /<\/[a-z][a-z0-9]*>/i.test(t)) {
		return true;
	}
	return false;
}

export function isMarkdownFileName(fileName: string | undefined): boolean {
	if (!fileName?.trim()) {
		return false;
	}
	const base = fileName.trim().split(/[/\\]/).pop() ?? fileName;
	const lower = base.toLowerCase();
	return lower.endsWith('.md') || lower.endsWith('.markdown');
}

export type TextPreviewBodyKind = 'plain' | 'html' | 'markdown';

/** Нормализация переводов строк после декодирования (Classic Mac \r, CRLF). */
export function normalizeTextPreviewNewlines(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Тело файла с расширением .md, но фактически HTML из Word/Google (style=, таблицы).
 * Обычный Markdown с угловыми скобками в коде не должен попадать сюда.
 */
export function mdFileBodyIsLikelyHtmlExport(text: string): boolean {
	if (!looksLikeHtmlFragment(text)) {
		return false;
	}
	const s = text.slice(0, 12_000);
	if (/<!doctype\s+html/i.test(s)) {
		return true;
	}
	if (/<p\s[^>]*style\s*=/i.test(s)) {
		return true;
	}
	if (/<h[1-6]\s[^>]*style\s*=/i.test(s)) {
		return true;
	}
	if (/<div\s[^>]*style\s*=/i.test(s)) {
		return true;
	}
	if (/<span\s[^>]*style\s*=/i.test(s)) {
		return true;
	}
	if (/<table\b/i.test(s) && /<tr\b/i.test(s)) {
		return true;
	}
	return false;
}

export function resolveTextPreviewBodyKind(
	text: string,
	fileName: string | undefined,
	mimeType: string | null | undefined
): TextPreviewBodyKind {
	const lowerName = (fileName ?? '').toLowerCase();
	const head = text.trim().slice(0, 24_000).toLowerCase();

	if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
		return 'html';
	}

	if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
		return 'html';
	}

	const mime = (mimeType ?? '').trim().toLowerCase();
	const treatAsMd =
		isMarkdownFileName(fileName) ||
		mime === 'text/markdown' ||
		mime === 'text/x-markdown';

	if (treatAsMd) {
		if (mdFileBodyIsLikelyHtmlExport(text)) {
			return 'html';
		}
		return 'markdown';
	}

	if (looksLikeHtmlFragment(text)) {
		return 'html';
	}

	return 'plain';
}
