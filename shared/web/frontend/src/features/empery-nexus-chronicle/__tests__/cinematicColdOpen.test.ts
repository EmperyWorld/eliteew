/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for cold-open session helpers and the timer-driven ritual beat contract.
 *
 * Related:
 * - motion/useCinematicColdOpen.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	COLD_OPEN_BEATS,
	COLD_OPEN_SESSION_KEY,
	hasCompletedColdOpen,
	initialChroniclePhase,
	markColdOpenDone,
} from '../motion/useCinematicColdOpen';

describe('cinematicColdOpen helpers', () => {
	afterEach(() => {
		sessionStorage.removeItem(COLD_OPEN_SESSION_KEY);
	});

	it('starts coldOpen when session is fresh', () => {
		expect(hasCompletedColdOpen()).toBe(false);
		expect(initialChroniclePhase()).toBe('coldOpen');
	});

	it('enters atlas after markColdOpenDone', () => {
		markColdOpenDone();
		expect(hasCompletedColdOpen()).toBe(true);
		expect(initialChroniclePhase()).toBe('atlas');
	});

	it('keeps the four ritual beats on the established 0/6/12/18s cadence', () => {
		expect(COLD_OPEN_BEATS.map((beat) => beat.at)).toEqual([0, 6, 12, 18]);
		expect(COLD_OPEN_BEATS.map((beat) => beat.chapter)).toEqual([
			'husk',
			'word',
			'constellation',
			'sovereignty',
		]);
	});
});
