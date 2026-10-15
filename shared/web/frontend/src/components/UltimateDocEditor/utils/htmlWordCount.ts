/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Единый подсчёт слов и символов для HTML и plain text в Ultimate Doc Editor (store, шапка, drafts).
 *
 * Invariants:
 * - Слова — непустые токены после нормализации пробелов (`split(/\s+/).filter(Boolean)`).
 * - HTML: strip style/script/tags, `&nbsp;` → пробел, `&amp;` → `&`, схлопывание whitespace.
 *
 * Related:
 * - `store/editorStore.ts`, `utils/ultimateDocEditorBootstrap.ts`, `utils/docEditorDraftLocal.ts`
 */

/** Plain text из HTML без тегов (для stats, AI context, preview). */
export function stripHtmlToPlainText(html: string): string {
	if (!html || typeof html !== 'string') {
		return '';
	}
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Слова в уже нормализованной plain-строке (TipTap `getText()`, comparable text). */
export function countWordsFromPlainText(text: string): number {
	if (!text || typeof text !== 'string') {
		return 0;
	}
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) {
		return 0;
	}
	return normalized.split(/\s+/).filter(Boolean).length;
}

/** Слова и символы по HTML-контенту документа. */
export function countWordsFromHtml(html: string): {
	words: number;
	characters: number;
} {
	const text = stripHtmlToPlainText(html);
	return {
		words: countWordsFromPlainText(text),
		characters: text.length,
	};
}

/** Plain text из HTML для контекста ИИ с ограничением длины. */
export function htmlToPlainForAi(html: string, maxLen: number): string {
	const plain = stripHtmlToPlainText(html);
	if (plain.length <= maxLen) {
		return plain;
	}
	return `${plain.slice(0, maxLen)}…`;
}
