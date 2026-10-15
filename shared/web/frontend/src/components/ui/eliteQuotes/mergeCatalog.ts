/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Merge category JSON shards into a sorted EliteEW quote catalog for React and static preloader sync.
 *
 * Invariants:
 * - Each catalog file name must match entry.category.
 * - Quote ids must be unique across the merged catalog.
 *
 * Related:
 * - `catalog/*.json`
 * - `scripts/generate-preloader-quotes.mjs`
 */

import disciplineQuotes from './catalog/discipline.json';
import leadershipQuotes from './catalog/leadership.json';
import perseveranceQuotes from './catalog/perseverance.json';
import strategyQuotes from './catalog/strategy.json';
import type { EliteQuote, EliteQuoteCategory } from './types';

const CATALOG_SHARDS: Record<EliteQuoteCategory, readonly EliteQuote[]> = {
	strategy: strategyQuotes as EliteQuote[],
	perseverance: perseveranceQuotes as EliteQuote[],
	leadership: leadershipQuotes as EliteQuote[],
	discipline: disciplineQuotes as EliteQuote[],
};

export const ELITE_QUOTE_CATEGORIES = Object.keys(
	CATALOG_SHARDS
) as EliteQuoteCategory[];

export function mergeEliteQuoteCatalog(): readonly EliteQuote[] {
	const merged: EliteQuote[] = [];
	const seen = new Set<string>();

	for (const category of ELITE_QUOTE_CATEGORIES) {
		for (const entry of CATALOG_SHARDS[category]) {
			if (entry.category !== category) {
				throw new Error(
					`Quote ${entry.id} category mismatch: file ${category}, entry ${entry.category}`
				);
			}
			if (seen.has(entry.id)) {
				throw new Error(`Duplicate elite quote id: ${entry.id}`);
			}
			seen.add(entry.id);
			merged.push(entry);
		}
	}

	return merged.sort((a, b) => a.id.localeCompare(b.id, 'ru'));
}

export const ELITE_QUOTES: readonly EliteQuote[] = mergeEliteQuoteCatalog();
