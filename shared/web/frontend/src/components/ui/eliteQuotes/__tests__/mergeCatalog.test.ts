/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	ELITE_QUOTE_CATEGORIES,
	ELITE_QUOTES,
	mergeEliteQuoteCatalog,
} from '../mergeCatalog';
import { ELITE_QUOTES_BY_CATEGORY } from '../quotes';

describe('mergeEliteQuoteCatalog', () => {
	it('merges four category shards with at least sixty quotes', () => {
		const merged = mergeEliteQuoteCatalog();
		expect(merged.length).toBeGreaterThanOrEqual(60);
		expect(ELITE_QUOTES.length).toBe(merged.length);
	});

	it('keeps unique ids across the catalog', () => {
		const ids = ELITE_QUOTES.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('exposes sixteen quotes per category pool', () => {
		for (const category of ELITE_QUOTE_CATEGORIES) {
			expect(ELITE_QUOTES_BY_CATEGORY[category].length).toBe(16);
		}
	});
});
