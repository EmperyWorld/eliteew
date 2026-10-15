/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk list excerpt formatting.
 */

import { describe, expect, it } from 'vitest';
import { formatEwDeskListExcerpt } from '../ewDeskListExcerpt';

describe('formatEwDeskListExcerpt', () => {
	it('returns empty for missing excerpt', () => {
		expect(formatEwDeskListExcerpt(null)).toBe('');
	});

	it('collapses whitespace and truncates long text', () => {
		const long = 'word '.repeat(40);
		const out = formatEwDeskListExcerpt(long, 20);
		expect(out.endsWith('…')).toBe(true);
		expect(out.length).toBeLessThanOrEqual(21);
	});
});
