/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для extractFaqSearchSnippet / faqAnswerSearchPreview.
 *
 * Related:
 * - pages/Desktop/utils/extractFaqSearchSnippet.ts
 */
import { describe, expect, it } from 'vitest';
import {
	extractFaqSearchSnippet,
	faqAnswerMatchesQuery,
	faqAnswerSearchPreview,
	stripMarkdownForSnippet,
} from '../extractFaqSearchSnippet';

describe('extractFaqSearchSnippet', () => {
	it('returns full text when shorter than maxLen', () => {
		expect(extractFaqSearchSnippet('Short answer', 'answer')).toBe(
			'Short answer'
		);
	});

	it('picks paragraph with most token overlap', () => {
		const body = [
			'Общие сведения о рабочем столе.',
			'Музыкальный плеер открывается из меню Пуск и воспроизводит треки.',
			'Другое приложение.',
		].join('\n\n');
		const snippet = extractFaqSearchSnippet(body, 'музыкальный плеер', 120);
		expect(snippet.toLowerCase()).toContain('музык');
	});

	it('strips markdown before preview', () => {
		const preview = faqAnswerSearchPreview(
			'## Заголовок\n\nОткройте **магазин** через [меню](/link).',
			'магазин'
		);
		expect(preview.toLowerCase()).toContain('магазин');
		expect(preview).not.toContain('##');
	});

	it('detects answer match by tokens', () => {
		expect(
			faqAnswerMatchesQuery('Ответ про **магазин** приложений.', 'маг')
		).toBe(true);
		expect(faqAnswerMatchesQuery('Другой текст.', 'маг')).toBe(false);
	});

	it('stripMarkdownForSnippet removes fenced blocks', () => {
		const plain = stripMarkdownForSnippet('До ```code``` после');
		expect(plain).not.toContain('code');
		expect(plain).toContain('До');
	});
});
