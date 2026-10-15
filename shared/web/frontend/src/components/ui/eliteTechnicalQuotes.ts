/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy re-export shim — quote data now lives in `eliteQuotes/`.
 *
 * Invariants:
 * - Do not add quotes here; edit `eliteQuotes/catalog/*.json`.
 *
 * Related:
 * - `eliteQuotes/index.ts`
 */

export {
	ELITE_QUOTES as ELITE_TECHNICAL_QUOTES,
	pickEliteQuote as pickEliteTechnicalQuote,
	type EliteQuote as EliteTechnicalQuote,
} from './eliteQuotes';
