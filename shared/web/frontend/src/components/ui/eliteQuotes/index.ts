/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public exports for the EliteEW quote registry.
 *
 * Related:
 * - `eliteTechnicalQuotes.ts` (legacy re-export shim)
 */

export { ELITE_QUOTES, mergeEliteQuoteCatalog } from './mergeCatalog';
export {
	ELITE_QUOTES_BY_CATEGORY,
	ELITE_RECOVERY_QUOTE_POOL,
	ELITE_TECHNICAL_QUOTES,
	ELITE_QUOTE_MAX_TEXT_LENGTH,
	getEliteQuotesByCategory,
	isLongEliteQuote,
} from './quotes';
export {
	findEliteQuoteIndex,
	pickEliteQuote,
	pickEliteQuoteIndex,
	pickNextEliteQuoteIndex,
	pickEliteTechnicalQuote,
	type PickEliteQuoteOptions,
} from './pickEliteQuote';
export {
	ELITE_RECOVERY_QUOTE_CATEGORIES,
	ELITE_QUOTE_ROTATION_MS,
	type EliteQuote,
	type EliteQuoteCategory,
	type EliteTechnicalQuote,
} from './types';
export {
	useEliteQuoteById,
	useRotatingEliteQuote,
	type UseRotatingEliteQuoteOptions,
} from './useRotatingEliteQuote';
