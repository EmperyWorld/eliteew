/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion progress bar SR helpers (U7.3).
 */

import { describe, expect, it } from 'vitest';

import {
	companionProgressBarA11y,
	companionProgressBarValueTextKey,
	companionProgressPercent,
} from '@/features/ewa/companionUx/companionProgressA11y';

describe('companionProgressPercent', () => {
	it('rounds to percent and caps at 100', () => {
		expect(companionProgressPercent(1, 4)).toBe(25);
		expect(companionProgressPercent(4, 4)).toBe(100);
		expect(companionProgressPercent(9, 4)).toBe(100);
	});

	it('returns 100 when completed flag is set', () => {
		expect(companionProgressPercent(0, 0, { completed: true })).toBe(100);
	});
});

describe('companionProgressBarA11y', () => {
	it('builds step-scale values', () => {
		expect(companionProgressBarA11y(2, 5)).toEqual({
			valueNow: 2,
			valueMin: 0,
			valueMax: 5,
			mode: 'step',
			current: 2,
			total: 5,
			percent: 40,
		});
	});

	it('builds percent-scale values', () => {
		expect(
			companionProgressBarA11y(2, 5, { percentScale: true })
		).toMatchObject({
			valueNow: 40,
			valueMin: 0,
			valueMax: 100,
			mode: 'percent',
			percent: 40,
		});
	});
});

describe('companionProgressBarValueTextKey', () => {
	it('maps mode to i18n keys', () => {
		expect(companionProgressBarValueTextKey('percent')).toBe(
			'ewaCompanion.progressBarPercentAria'
		);
		expect(companionProgressBarValueTextKey('step')).toBe(
			'ewaCompanion.progressBarStepAria'
		);
	});
});
