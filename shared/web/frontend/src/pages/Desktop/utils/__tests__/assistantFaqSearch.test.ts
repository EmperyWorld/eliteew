/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для filterFaqEntries / faqEntryScore.
 *
 * Related:
 * - pages/Desktop/utils/assistantFaqSearch.ts
 */
import { describe, expect, it } from 'vitest';
import type { AssistantFaqEntry } from '../../services/productDesktopApi';
import { faqEntryScore, filterFaqEntries } from '../assistantFaqSearch';

const faq: AssistantFaqEntry[] = [
	{
		id: '1',
		question: 'Как открыть магазин?',
		answer: 'Через меню Пуск.',
		sort_order: 0,
	},
	{
		id: '2',
		question: 'Музыкальный плеер',
		answer: 'Откройте плеер из магазина приложений.',
		sort_order: 1,
	},
];

describe('assistantFaqSearch', () => {
	it('scores question match higher than answer-only', () => {
		const qScore = faqEntryScore('магазин', faq[0].question, faq[0].answer);
		const aScore = faqEntryScore('магазин', faq[1].question, faq[1].answer);
		expect(qScore).toBeGreaterThan(aScore);
	});

	it('sorts filtered entries by relevance', () => {
		const out = filterFaqEntries(faq, 'магазин');
		expect(out.map((f) => f.id)).toEqual(['1', '2']);
	});

	it('returns all entries when query empty', () => {
		expect(filterFaqEntries(faq, '')).toEqual(faq);
	});
});
