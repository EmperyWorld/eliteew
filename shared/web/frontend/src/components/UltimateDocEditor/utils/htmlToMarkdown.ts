/**
 * HTML → Markdown для режима «Исходник Markdown».
 * Используется Turndown (как в стеке уже есть), чтобы сохранялись абзацы и структура;
 * прежняя regex-реализация склеивала документ в одну строку.
 */
import TurndownService from 'turndown';

import { log } from '../../../utils/logger';

const turndown = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
	emDelimiter: '*',
	strongDelimiter: '**',
});

export function htmlToMarkdown(html: string): string {
	const raw = (html ?? '').trim();
	if (!raw) {
		return '';
	}
	if (!raw.includes('<')) {
		return raw;
	}
	try {
		return turndown.turndown(raw).trim();
	} catch (e) {
		log.warn(
			'htmlToMarkdown',
			'Turndown failed, returning empty markdown fallback',
			e instanceof Error ? e : undefined
		);
		return '';
	}
}
