/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fisher–Yates shuffle bag for quote rotation — every pool entry once per round before repeat.
 *
 * Invariants:
 * - poolLength <= 1: always index 0.
 * - After each full round, reshuffle with first index != previous last (when possible).
 *
 * Related:
 * - `useRotatingEliteQuote.ts`
 * - `public/preloader-fallback.js`
 */

export type EliteQuoteShuffleBag = {
	pickInitial(): number;
	pickNext(currentIndex: number): number;
};

export function createEliteQuoteShuffleBag(
	poolLength: number
): EliteQuoteShuffleBag {
	if (poolLength <= 1) {
		return {
			pickInitial: () => 0,
			pickNext: () => 0,
		};
	}

	let order: number[] = [];
	let pos = 0;

	const reshuffle = (excludeFirst?: number): void => {
		order = Array.from({ length: poolLength }, (_, index) => index);
		for (let i = poolLength - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		if (
			excludeFirst !== undefined &&
			poolLength > 1 &&
			order[0] === excludeFirst
		) {
			[order[0], order[1]] = [order[1], order[0]];
		}
		pos = 0;
	};

	return {
		pickInitial() {
			reshuffle();
			return order[0] ?? 0;
		},
		pickNext(currentIndex: number) {
			pos += 1;
			if (pos >= order.length) {
				reshuffle(currentIndex);
			}
			return order[pos] ?? 0;
		},
	};
}
