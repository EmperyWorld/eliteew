/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Converts markdown-like imported document bodies into sanitized editor HTML.
 *
 * Invariants:
 * - Markdown conversion output is sanitized before entering TipTap/editor preview state.
 * - Single-paragraph markdown repair never returns raw marked output.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/ultimateDocEditorBootstrap.ts
 * - src/components/UltimateDocEditor/utils/renderMarkdownToHtml.ts
 */
import { marked } from 'marked';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';

marked.setOptions({
	gfm: true,
	breaks: true,
});

function stripHtmlEntities(inner: string): string {
	return inner
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"');
}

/**
 * Разворачивает «сжатый» markdown в одну строку (часто после импорта/копирования).
 */
export function expandCompressedMarkdownOneLine(md: string): string {
	let s = md.replace(/\r\n/g, '\n').trim();
	if (!s) return s;
	if (s.split('\n').length > 3) return s;

	// Списки после двоеточия/точки с запятой: «они: - пункт»; «solo»; - следующий
	s = s.replace(/([;:])\s*-\s+/g, '$1\n- ');
	s = s.replace(/([;:])\s*\\\s*-\s+/g, '$1\n- ');
	s = s.replace(/([.;])\s+-\s+/g, '$1\n- ');

	// Заголовок на латинице, далее абзац с кириллицей (частый случай смешанного заголовка)
	s = s.replace(
		/^(\s{0,3}#{1,6}\s+[\s\S]*?)([A-Za-z])(\s+)([А-ЯЁ])/u,
		'$1$2$3\n\n$4'
	);
	return s;
}

export function markdownToEditorHtml(md: string): string {
	const raw = (md ?? '').trim();
	if (!raw) {
		return '<p></p>';
	}
	const src =
		raw.includes('\n') && raw.split('\n').length > 3
			? raw
			: expandCompressedMarkdownOneLine(raw);
	const html = marked.parse(src, { async: false }) as string;
	const trimmed = sanitizeUserHtml(html).trim();
	return trimmed || '<p></p>';
}

/**
 * HTML из одного <p> с текстом, похожим на markdown (часто после ошибочного сохранения).
 */
export function repairHtmlIfSingleParagraphMarkdown(
	html: string
): string | null {
	const trimmed = (html ?? '').trim();
	if (!trimmed.startsWith('<')) return null;
	if (/<\/(h[1-6]|ul|ol|table)\b/i.test(trimmed)) return null;
	const m = trimmed.match(/^<p[^>]*>([\s\S]*)<\/p>\s*$/i);
	if (!m) return null;
	let inner = m[1];
	inner = inner.replace(/<br\s*\/?>/gi, '\n');
	const plain = stripHtmlEntities(inner).trim();
	if (plain.length < 4) return null;
	const looksMd =
		/^#{1,6}\s/.test(plain) ||
		/^[-*+]\s/m.test(plain) ||
		/:\s*-\s/.test(plain) ||
		/[.;]\s+-\s/.test(plain) ||
		/\\\s*-\s/.test(plain);
	if (!looksMd) return null;
	return markdownToEditorHtml(plain);
}
