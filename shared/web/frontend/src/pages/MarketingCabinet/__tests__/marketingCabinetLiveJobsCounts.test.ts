/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for marketing-cabinet live jobs count helpers.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - utils/marketingCabinetLiveJobsCounts.ts
 */
import { describe, expect, it } from 'vitest';

import {
	marketingCabinetActiveRunListCount,
	marketingCabinetLiveJobsSummaryActiveTotal,
	marketingCabinetProjectLiveJobsPollIntervalMs,
} from '../utils/marketingCabinetLiveJobsCounts';

describe('marketingCabinetActiveRunListCount', () => {
	it('prefers total over items length', () => {
		expect(marketingCabinetActiveRunListCount({ items: [{}], total: 12 })).toBe(
			12
		);
	});

	it('falls back to items length', () => {
		expect(marketingCabinetActiveRunListCount({ items: [{}, {}] })).toBe(2);
	});
});

describe('marketingCabinetLiveJobsSummaryActiveTotal', () => {
	it('sums ai and imc totals', () => {
		expect(
			marketingCabinetLiveJobsSummaryActiveTotal({
				ai_active_total: 2,
				imc_active_total: 3,
			})
		).toBe(5);
	});
});

describe('marketingCabinetProjectLiveJobsPollIntervalMs', () => {
	it('polls when any active', () => {
		expect(
			marketingCabinetProjectLiveJobsPollIntervalMs({
				ai_active_total: 1,
				imc_active_total: 0,
			})
		).toBe(4500);
	});

	it('stops poll when idle', () => {
		expect(
			marketingCabinetProjectLiveJobsPollIntervalMs({
				ai_active_total: 0,
				imc_active_total: 0,
			})
		).toBe(false);
	});
});
