/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Precomputed EliteEW quote pools for preloaders, recovery screens and technical states.
 *
 * Invariants:
 * - Data lives in `catalog/*.json`; edit shards to add quotes.
 *
 * Related:
 * - `mergeCatalog.ts`
 * - `scripts/generate-preloader-quotes.mjs`
 */

import { ELITE_QUOTES, mergeEliteQuoteCatalog } from './mergeCatalog';
import {
	ELITE_RECOVERY_QUOTE_CATEGORIES,
	type EliteQuote,
	type EliteQuoteCategory,
} from './types';

export { ELITE_QUOTES, mergeEliteQuoteCatalog };

/** @deprecated Use `ELITE_QUOTES`. */
export const ELITE_TECHNICAL_QUOTES: readonly EliteQuote[] = ELITE_QUOTES;

function buildCategoryMap(): Record<EliteQuoteCategory, readonly EliteQuote[]> {
	const map: Record<EliteQuoteCategory, EliteQuote[]> = {
		strategy: [],
		perseverance: [],
		leadership: [],
		discipline: [],
	};
	for (const quote of ELITE_QUOTES) {
		map[quote.category].push(quote);
	}
	return map;
}

export const ELITE_QUOTES_BY_CATEGORY: Record<
	EliteQuoteCategory,
	readonly EliteQuote[]
> = buildCategoryMap();

const recoveryIds = new Set<EliteQuoteCategory>(
	ELITE_RECOVERY_QUOTE_CATEGORIES
);
export const ELITE_RECOVERY_QUOTE_POOL: readonly EliteQuote[] =
	ELITE_QUOTES.filter((quote) => recoveryIds.has(quote.category));

export function getEliteQuotesByCategory(
	category: EliteQuoteCategory | readonly EliteQuoteCategory[]
): readonly EliteQuote[] {
	const categories = Array.isArray(category) ? category : [category];
	if (categories.length === 1) {
		return ELITE_QUOTES_BY_CATEGORY[categories[0]] ?? ELITE_QUOTES;
	}
	const allowed = new Set(categories);
	const merged: EliteQuote[] = [];
	for (const cat of categories) {
		for (const quote of ELITE_QUOTES_BY_CATEGORY[cat]) {
			if (allowed.has(quote.category)) {
				merged.push(quote);
			}
		}
	}
	return merged.length > 0 ? merged : ELITE_QUOTES;
}

export const ELITE_QUOTE_MAX_TEXT_LENGTH = 120;

export function isLongEliteQuote(text: string): boolean {
	return text.length > 80;
}
