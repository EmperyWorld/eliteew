/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for the embedded EWA document editor output surface: payload coercion, markdown normalization and text replacement.
 *
 * Invariants:
 * - Helpers are deterministic and never call AI or persistence APIs.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionDocumentEditorMode.tsx
 */

export type CompanionDocumentSurfacePayload = {
	documentId: string | null;
	title: string;
	initialMarkdown: string;
	sourceFormat: string;
	parseWarnings: string[];
	source: 'companion_action' | 'file_list' | 'output_surface' | 'manual';
};

export type TextSelectionRange = {
	start: number;
	end: number;
	text: string;
};

function readString(
	payload: Record<string, unknown> | undefined,
	key: string
): string {
	const raw = payload?.[key];
	return typeof raw === 'string' ? raw.trim() : '';
}

function readStringList(
	payload: Record<string, unknown> | undefined,
	key: string
): string[] {
	const raw = payload?.[key];
	if (!Array.isArray(raw)) return [];
	return raw
		.map((item) => (typeof item === 'string' ? item.trim() : ''))
		.filter(Boolean);
}

function htmlToPlainTextFallback(html: string): string {
	const normalized = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|section|article|li|h[1-6])\s*>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
	return normalized
		.replace(/\r\n?/g, '\n')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function coerceCompanionDocumentSurfacePayload(
	payload: Record<string, unknown> | undefined
): CompanionDocumentSurfacePayload {
	const markdownFromPayload =
		readString(payload, 'content_markdown') ||
		readString(payload, 'contentMarkdown') ||
		readString(payload, 'initialMarkdown') ||
		readString(payload, 'plain_text') ||
		readString(payload, 'plainText') ||
		readString(payload, 'content');
	const initialHtml =
		readString(payload, 'initialHtml') || readString(payload, 'initial_html');
	const fallbackMarkdown =
		!markdownFromPayload && initialHtml
			? htmlToPlainTextFallback(initialHtml)
			: '';
	const sourceFormatRaw =
		readString(payload, 'source_format') || readString(payload, 'sourceFormat');
	const warningsBase =
		readStringList(payload, 'parse_warnings').length > 0
			? readStringList(payload, 'parse_warnings')
			: readStringList(payload, 'parseWarnings');
	const warnings = new Set(warningsBase);
	if (!markdownFromPayload && initialHtml && fallbackMarkdown) {
		warnings.add('initial_html_plaintext_fallback');
	}
	return {
		documentId:
			readString(payload, 'documentId') ||
			readString(payload, 'unifiedContentId') ||
			readString(payload, 'unified_content_id') ||
			null,
		title: readString(payload, 'title') || 'Document',
		initialMarkdown: markdownFromPayload || fallbackMarkdown,
		sourceFormat: sourceFormatRaw || (initialHtml ? 'html' : 'unknown'),
		parseWarnings: [...warnings],
		source:
			readString(payload, 'source') === 'companion_action'
				? 'companion_action'
				: readString(payload, 'source') === 'file_list'
					? 'file_list'
					: readString(payload, 'source') === 'manual'
						? 'manual'
						: 'output_surface',
	};
}

export function selectedTextRange(
	value: string,
	start: number | null | undefined,
	end: number | null | undefined
): TextSelectionRange | null {
	if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
	const a = Math.max(0, Math.min(value.length, Math.trunc(start ?? 0)));
	const b = Math.max(0, Math.min(value.length, Math.trunc(end ?? 0)));
	if (a === b) return null;
	const from = Math.min(a, b);
	const to = Math.max(a, b);
	return { start: from, end: to, text: value.slice(from, to) };
}

export function applyDocumentSurfaceReplacement(
	value: string,
	selection: TextSelectionRange | null,
	replacement: string
): string {
	if (!selection) return replacement;
	return `${value.slice(0, selection.start)}${replacement}${value.slice(selection.end)}`;
}

export function buildDocumentSurfacePrompt(
	action: 'improve' | 'fix' | 'shorten' | 'custom',
	customPrompt: string,
	ru: boolean
): string {
	const custom = customPrompt.trim();
	if (custom) return custom;
	if (action === 'fix') {
		return ru
			? 'Исправь ошибки, сохрани смысл и верни только новый текст фрагмента.'
			: 'Fix mistakes, preserve meaning, and return only the revised fragment.';
	}
	if (action === 'shorten') {
		return ru
			? 'Сократи текст, сохрани ключевые факты и верни только новую версию.'
			: 'Shorten the text, preserve key facts, and return only the new version.';
	}
	return ru
		? 'Улучши стиль и ясность, сохрани смысл и верни только новый текст фрагмента.'
		: 'Improve style and clarity, preserve meaning, and return only the revised fragment.';
}
