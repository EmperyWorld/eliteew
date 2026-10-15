/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for taskbar clock cadence helpers (minute/second alignment).
 *
 * Invariants:
 * - Delay never returns 0 (avoids tight re-scheduling loops).
 *
 * Related:
 * - src/pages/Desktop/utils/taskbarClockTiming.ts
 */

import { describe, expect, it } from 'vitest';
import {
	getTaskbarClockInitialDelayMs,
	getTaskbarClockTickMs,
} from '../taskbarClockTiming';

describe('taskbarClockTiming', () => {
	it('uses 60s cadence in minute mode', () => {
		expect(getTaskbarClockTickMs(false)).toBe(60_000);
	});

	it('aligns minute mode to the next minute boundary', () => {
		const now = new Date('2026-06-22T10:23:05.250Z');
		expect(getTaskbarClockInitialDelayMs({ showSeconds: false, now })).toBe(
			54_750
		);
	});

	it('returns full cadence when already on minute boundary', () => {
		const now = new Date('2026-06-22T10:23:00.000Z');
		expect(getTaskbarClockInitialDelayMs({ showSeconds: false, now })).toBe(
			60_000
		);
	});

	it('aligns second mode to the next second boundary', () => {
		const now = new Date('2026-06-22T10:23:05.250Z');
		expect(getTaskbarClockInitialDelayMs({ showSeconds: true, now })).toBe(750);
	});

	it('returns full second cadence on exact second boundary', () => {
		const now = new Date('2026-06-22T10:23:05.000Z');
		expect(getTaskbarClockInitialDelayMs({ showSeconds: true, now })).toBe(
			1_000
		);
	});
});
