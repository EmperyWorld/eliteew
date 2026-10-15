import { describe, expect, it } from 'vitest';

import {
	countWordsFromHtml,
	countWordsFromPlainText,
	htmlToPlainForAi,
	stripHtmlToPlainText,
} from './htmlWordCount';

describe('htmlWordCount', () => {
	it('counts words with collapsed whitespace in HTML', () => {
		expect(countWordsFromHtml('<p>hello   world</p>')).toEqual({
			words: 2,
			characters: 11,
		});
	});

	it('treats nbsp as word separator', () => {
		expect(countWordsFromHtml('<p>one&nbsp;two</p>')).toEqual({
			words: 2,
			characters: 7,
		});
	});

	it('ignores style and script blocks', () => {
		expect(
			countWordsFromHtml(
				'<style>.x{}</style><script>alert(1)</script><p>visible</p>'
			)
		).toEqual({
			words: 1,
			characters: 7,
		});
	});

	it('returns zero for empty or non-string input', () => {
		expect(countWordsFromHtml('')).toEqual({ words: 0, characters: 0 });
		expect(countWordsFromHtml('<p></p>')).toEqual({ words: 0, characters: 0 });
	});

	it('countWordsFromPlainText matches HTML path for equivalent text', () => {
		const plain = 'alpha beta  gamma';
		expect(countWordsFromPlainText(plain)).toBe(3);
		expect(countWordsFromHtml(`<p>${plain}</p>`).words).toBe(3);
	});

	it('htmlToPlainForAi truncates with ellipsis', () => {
		const long = 'word '.repeat(20).trim();
		const out = htmlToPlainForAi(`<p>${long}</p>`, 10);
		expect(out.endsWith('…')).toBe(true);
		expect(out.length).toBe(11);
	});

	it('stripHtmlToPlainText decodes amp entity', () => {
		expect(stripHtmlToPlainText('<p>a &amp; b</p>')).toBe('a & b');
	});
});
