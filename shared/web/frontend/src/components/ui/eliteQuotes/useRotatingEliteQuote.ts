/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React hook that rotates bundled EliteEW quotes on an interval for long waiting states.
 *
 * Invariants:
 * - Never shows the same quote twice in a row when pool size > 1.
 * - Next index uses uniform random from pool (not timestamp modulo — avoids tiny cycles).
 * - intervalMs <= 0 disables rotation.
 *
 * Related:
 * - `EliteRecoveryScreen.tsx`
 * - `EliteTechnicalState.tsx`
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createEliteQuoteShuffleBag } from './eliteQuoteShuffleBag';
import { pickEliteQuoteIndex, findEliteQuoteIndex } from './pickEliteQuote';
import {
	ELITE_QUOTES,
	ELITE_RECOVERY_QUOTE_POOL,
	getEliteQuotesByCategory,
} from './quotes';
import type { EliteQuote, EliteQuoteCategory } from './types';

export type UseRotatingEliteQuoteOptions = {
	category?: EliteQuoteCategory | readonly EliteQuoteCategory[];
	intervalMs?: number;
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
		category.includes('perseverance') &&
		category.includes('strategy') &&
		category.length === 2
	) {
		return ELITE_RECOVERY_QUOTE_POOL;
	}
	const filtered = getEliteQuotesByCategory(category);
	return filtered.length > 0 ? filtered : ELITE_QUOTES;
}

export function useRotatingEliteQuote(
	options?: UseRotatingEliteQuoteOptions
): EliteQuote {
	const pool = useMemo(
		() => resolvePool(options?.category),
		[options?.category]
	);

	const bagRef = useRef(createEliteQuoteShuffleBag(pool.length));

	useEffect(() => {
		bagRef.current = createEliteQuoteShuffleBag(pool.length);
	}, [pool.length]);

	const initialIndex = useMemo(() => {
		if (options?.seed !== undefined) {
			return pickEliteQuoteIndex(pool, options.seed);
		}
		return bagRef.current.pickInitial();
	}, [pool, options?.seed]);

	const [index, setIndex] = useState(initialIndex);

	useEffect(() => {
		setIndex(initialIndex);
	}, [initialIndex]);

	useEffect(() => {
		const intervalMs = options?.intervalMs ?? 0;
		if (intervalMs <= 0 || pool.length <= 1) {
			return;
		}
		const timer = window.setInterval(() => {
			setIndex((current) => bagRef.current.pickNext(current));
		}, intervalMs);
		return () => window.clearInterval(timer);
	}, [options?.intervalMs, pool]);

	return pool[index] ?? pool[0];
}

export function useEliteQuoteById(
	quoteId: string | undefined,
	pool: readonly EliteQuote[] = ELITE_QUOTES
): EliteQuote {
	return useMemo(() => {
		if (!quoteId) {
			return pool[0] ?? ELITE_QUOTES[0];
		}
		const index = findEliteQuoteIndex(pool, quoteId);
		return pool[index] ?? pool[0] ?? ELITE_QUOTES[0];
	}, [pool, quoteId]);
}
