/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EliteQuoteBlock } from '../EliteQuoteBlock';

const sampleQuote = {
	id: 'hannibal-road',
	author: 'Ганнибал',
	text: 'Мы либо найдём дорогу, либо проложим её сами.',
	category: 'strategy' as const,
};

const longQuote = {
	id: 'long-sample',
	author: 'Тест Автор',
	text: 'Очень длинная цитата для проверки уменьшенного размера шрифта при превышении восьмидесяти символов в тексте.',
	category: 'discipline' as const,
};

describe('EliteQuoteBlock', () => {
	it('always renders historical author cite with dash class', () => {
		const { container } = render(
			<EliteQuoteBlock quote={sampleQuote} variant="light" />
		);
		expect(screen.getByText('Ганнибал')).toBeTruthy();
		expect(
			screen.getByText('«Мы либо найдём дорогу, либо проложим её сами.»')
		).toBeTruthy();
		expect(container.querySelector('.elite-quote-author')).toBeTruthy();
	});

	it('uses smaller typography for long quotes', () => {
		const { container } = render(
			<EliteQuoteBlock quote={longQuote} variant="dark" />
		);
		const text = container.querySelector('blockquote p');
		expect(text?.className).toContain('text-lg');
		expect(text?.className).not.toContain('text-xl');
	});
});
