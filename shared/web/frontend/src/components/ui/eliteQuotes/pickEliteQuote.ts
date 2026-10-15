/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deterministic and random quote selection for preloaders, recovery screens and technical states.
 *
 * Invariants:
 * - No network calls; pool is always local bundled catalog.
 *
 * Related:
 * - `useRotatingEliteQuote.ts`
 * - `quotes.ts`
 */

import {
	ELITE_QUOTES,
	ELITE_RECOVERY_QUOTE_POOL,
	getEliteQuotesByCategory,
} from './quotes';
import type { EliteQuote, EliteQuoteCategory } from './types';

export type PickEliteQuoteOptions = {
	category?: EliteQuoteCategory | readonly EliteQuoteCategory[];
	seed?: number;
};

function resolvePool(
	category?: EliteQuoteCategory | readonly EliteQuoteCategory[]
): readonly EliteQuote[] {
	if (!category) {
		return ELITE_QUOTES;
	}
	if (
		Array.isArray(category) &&
		category.length === 2 &&
		category.includes('perseverance') &&
		category.includes('strategy')
	) {
		return ELITE_RECOVERY_QUOTE_POOL;
	}
	const filtered = getEliteQuotesByCategory(category);
	return filtered.length > 0 ? filtered : ELITE_QUOTES;
}

export function pickEliteQuote(options?: PickEliteQuoteOptions): EliteQuote {
	const pool = resolvePool(options?.category);
	const index =
		options?.seed !== undefined
			? pickEliteQuoteIndex(pool, options.seed)
			: pickEliteQuoteIndex(pool);
	return pool[index] ?? ELITE_QUOTES[0];
}

/** @deprecated Use `pickEliteQuote`. */
export function pickEliteTechnicalQuote(seed = Date.now()): EliteQuote {
	return pickEliteQuote({ seed });
}

export function pickEliteQuoteIndex(
	pool: readonly EliteQuote[],
	seed?: number
): number {
	if (pool.length === 0) {
		return 0;
	}
	if (seed !== undefined) {
		return Math.abs(Math.floor(seed)) % pool.length;
	}
	return Math.floor(Math.random() * pool.length);
}

export function pickNextEliteQuoteIndex(
	pool: readonly EliteQuote[],
	currentIndex: number
): number {
	if (pool.length <= 1) {
		return 0;
	}
	let next = Math.floor(Math.random() * pool.length);
	let guard = 0;
	while (next === currentIndex && guard < 12) {
		next = Math.floor(Math.random() * pool.length);
		guard += 1;
	}
	if (next === currentIndex) {
		next = (currentIndex + 1) % pool.length;
	}
	return next;
}

export function findEliteQuoteIndex(
	pool: readonly EliteQuote[],
	quoteId: string
): number {
	const index = pool.findIndex((entry) => entry.id === quoteId);
	return index >= 0 ? index : 0;
}
