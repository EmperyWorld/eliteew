/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	findEliteQuoteIndex,
	pickEliteQuote,
	pickNextEliteQuoteIndex,
} from '../pickEliteQuote';
import {
	ELITE_QUOTES,
	ELITE_RECOVERY_QUOTE_POOL,
	getEliteQuotesByCategory,
} from '../quotes';

describe('pickEliteQuote', () => {
	it('returns stable quote for the same seed', () => {
		const first = pickEliteQuote({ seed: 42 });
		const second = pickEliteQuote({ seed: 42 });
		expect(first.id).toBe(second.id);
	});

	it('filters by category', () => {
		const quote = pickEliteQuote({ category: 'perseverance', seed: 1 });
		expect(quote.category).toBe('perseverance');
	});

	it('uses recovery pool for perseverance + strategy categories', () => {
		const quote = pickEliteQuote({
			category: ['perseverance', 'strategy'],
			seed: 7,
		});
		expect(
			ELITE_RECOVERY_QUOTE_POOL.some((entry) => entry.id === quote.id)
		).toBe(true);
	});

	it('exposes sixty-four categorized quotes', () => {
		const filtered = getEliteQuotesByCategory('perseverance');
		expect(filtered.length).toBe(16);
		expect(ELITE_QUOTES.length).toBeGreaterThanOrEqual(60);
	});
});

describe('pickNextEliteQuoteIndex', () => {
	const pool = ELITE_RECOVERY_QUOTE_POOL;

	it('never returns the same index when pool has multiple entries', () => {
		for (let current = 0; current < pool.length; current += 1) {
			const next = pickNextEliteQuoteIndex(pool, current);
			expect(next).not.toBe(current);
		}
	});

	it('can reach many distinct indices over repeated picks (not a tiny cycle)', () => {
		const seen = new Set<number>();
		let current = 0;
		for (let i = 0; i < 48; i += 1) {
			current = pickNextEliteQuoteIndex(pool, current);
			seen.add(current);
		}
		expect(seen.size).toBeGreaterThan(8);
	});

	it('finds quote index by id', () => {
		const quote = pool[3];
		expect(findEliteQuoteIndex(pool, quote.id)).toBe(3);
	});
});
