/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for the EliteEW inspirational quote registry used in preloaders and recovery screens.
 *
 * Invariants:
 * - Quote categories are stable string unions; extend only with doc updates.
 *
 * Related:
 * - `catalog/*.json`
 * - `pickEliteQuote.ts`
 */

export type EliteQuoteCategory =
	| 'strategy'
	| 'perseverance'
	| 'leadership'
	| 'discipline';

export type EliteQuote = {
	id: string;
	author: string;
	text: string;
	category: EliteQuoteCategory;
};

/** Categories rotated on recovery/waiting full-screen states. */
export const ELITE_RECOVERY_QUOTE_CATEGORIES: readonly EliteQuoteCategory[] = [
	'perseverance',
	'strategy',
] as const;

/** Default quote rotation interval for recovery/waiting screens (ms). */
export const ELITE_QUOTE_ROTATION_MS = 7_000;

/** @deprecated Use `EliteQuote` — kept for gradual migration. */
export type EliteTechnicalQuote = Pick<EliteQuote, 'author' | 'text'>;
