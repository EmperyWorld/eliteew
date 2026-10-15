/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk date formatting edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
	formatEwDeskNewsDate,
	formatEwDeskRelativeNewsDate,
} from '../ewDeskFormatting';

describe('ewDeskFormatting', () => {
	it('returns empty string for missing iso', () => {
		expect(formatEwDeskNewsDate(null)).toBe('');
		expect(formatEwDeskRelativeNewsDate(null, 'ru')).toBe('');
	});

	it('returns raw iso when date is invalid', () => {
		const raw = 'not-a-date';
		expect(formatEwDeskNewsDate(raw)).toBe(raw);
		expect(formatEwDeskRelativeNewsDate(raw, 'ru')).toBe('');
	});

	it('formats valid iso timestamps', () => {
		const iso = '2026-05-27T12:00:00.000Z';
		expect(formatEwDeskNewsDate(iso).length).toBeGreaterThan(0);
		expect(formatEwDeskRelativeNewsDate(iso, 'ru').length).toBeGreaterThan(0);
	});
});
