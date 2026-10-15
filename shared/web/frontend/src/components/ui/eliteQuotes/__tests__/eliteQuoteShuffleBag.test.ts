/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import { createEliteQuoteShuffleBag } from '../eliteQuoteShuffleBag';

describe('createEliteQuoteShuffleBag', () => {
	it('visits every index once per round before repeating', () => {
		const bag = createEliteQuoteShuffleBag(8);
		let current = bag.pickInitial();
		const seen = new Set<number>([current]);
		for (let i = 0; i < 7; i += 1) {
			current = bag.pickNext(current);
			expect(seen.has(current)).toBe(false);
			seen.add(current);
		}
		expect(seen.size).toBe(8);
	});

	it('does not repeat consecutive picks when pool > 1', () => {
		const bag = createEliteQuoteShuffleBag(16);
		let current = bag.pickInitial();
		for (let i = 0; i < 20; i += 1) {
			const next = bag.pickNext(current);
			expect(next).not.toBe(current);
			current = next;
		}
	});
});
