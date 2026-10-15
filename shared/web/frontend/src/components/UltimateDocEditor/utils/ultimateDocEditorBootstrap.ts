/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure bootstrap helpers that normalize loaded document content and compute
 * editor statistics for Ultimate Doc Editor.
 *
 * Invariants:
 * - HTML/markdown entering the editor bootstrap path is sanitized before preview rendering.
 * - Plain text is converted through the dedicated text-to-HTML path.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/markdownToHtml.ts
 * - src/components/UltimateDocEditor/chrome/UltimateDocEditorMainGrid.tsx
 */

import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';
import type { UltimateDocument } from '../types/editor.types';
import {
	convertPlainTextToHtml,
	normalizeNewlinesInHtml,
} from './htmlComparableText';
import {
	markdownToEditorHtml,
	repairHtmlIfSingleParagraphMarkdown,
} from './markdownToHtml';
import { prepareOfficeHtmlForTipTap } from './prepareOfficeHtmlForTipTap';
import { countWordsFromHtml } from './htmlWordCount';

export const HTML_TAG_REGEX = /<[^>]*>/i;
export const HTML_TAGS_GLOBAL_REGEX = /<[^>]*>/g;

export function contentToPlainText(content: string): string {
	return content
		.replace(HTML_TAGS_GLOBAL_REGEX, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function calculateStats(html: string): {
	words: number;
	characters: number;
} {
	return countWordsFromHtml(html);
}

/** Загрузка из API: markdown → HTML, один <p> с md — починка, иначе как normalizeContentToHtml. */
export function normalizeDocumentContentForEditor(
	raw: string,
	contentType?: UltimateDocument['content_type']
): string {
	if (!raw) {
		return '<p></p>';
	}
	if (contentType === 'markdown') {
		return markdownToEditorHtml(raw);
	}
	if (contentType === 'text') {
		return convertPlainTextToHtml(raw);
	}
	const trimmed = raw.trim();
	if (HTML_TAG_REGEX.test(trimmed)) {
		const bodyReady = prepareOfficeHtmlForTipTap(raw);
		const repaired = repairHtmlIfSingleParagraphMarkdown(bodyReady);
		if (repaired) {
			return sanitizeUserHtml(repaired);
		}
		return sanitizeUserHtml(normalizeNewlinesInHtml(bodyReady));
	}
	return convertPlainTextToHtml(raw);
}
