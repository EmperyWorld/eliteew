/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest для splitFaqHighlightSegments (подсветка FAQ-поиска).
 *
 * Related:
 * - pages/Desktop/utils/assistantFaqHighlight.tsx
 */
import { describe, expect, it } from 'vitest';
import { splitFaqHighlightSegments } from '../assistantFaqHighlight';

describe('splitFaqHighlightSegments', () => {
	it('returns plain segment when query empty', () => {
		expect(splitFaqHighlightSegments('Hello world', '')).toEqual([
			{ text: 'Hello world', highlight: false },
		]);
	});

	it('highlights matching token case-insensitively', () => {
		const segs = splitFaqHighlightSegments('Как открыть Магазин?', 'магаз');
		const highlighted = segs.filter((s) => s.highlight).map((s) => s.text);
		expect(highlighted.join('')).toBe('Магаз');
	});

	it('ignores single-char tokens', () => {
		expect(splitFaqHighlightSegments('A test', 'a b')).toEqual([
			{ text: 'A test', highlight: false },
		]);
	});
});
