/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for opt-in desktop realtime Performance marks (zero cost when off).
 *
 * Invariants:
 * - Marks are not created unless isPerfMode / persisted flag is enabled.
 *
 * Related:
 * - services/communication/desktopRealtimePerfTelemetry.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ensureDesktopRealtimePerfConsoleInstalled,
	isDesktopRealtimePerfMode,
	markInvalidationEnd,
	markInvalidationStart,
	markSocketArrival,
	setDesktopRealtimePerfMode,
} from '../desktopRealtimePerfTelemetry';

describe('desktopRealtimePerfTelemetry', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		window.localStorage.removeItem('eliteew_desktop_realtime_perf_mode');
		window.isPerfMode = false;
		ensureDesktopRealtimePerfConsoleInstalled();
		setDesktopRealtimePerfMode(false);
	});

	afterEach(() => {
		setDesktopRealtimePerfMode(false);
		window.isPerfMode = false;
	});

	it('does not call performance.mark when perf mode is off', () => {
		const mark = vi
			.spyOn(performance, 'mark')
			.mockImplementation(() => ({}) as PerformanceMark);
		markSocketArrival('gaf_chat.message_new');
		markInvalidationStart();
		markInvalidationEnd();
		expect(mark).not.toHaveBeenCalled();
		expect(isDesktopRealtimePerfMode()).toBe(false);
	});

	it('emits exact mark names when perf mode is on', () => {
		const mark = vi
			.spyOn(performance, 'mark')
			.mockImplementation(() => ({}) as PerformanceMark);
		const measure = vi
			.spyOn(performance, 'measure')
			.mockImplementation(() => ({}) as PerformanceMeasure);
		setDesktopRealtimePerfMode(true);
		expect(window.isPerfMode).toBe(true);

		markSocketArrival('gaf_chat.message_new');
		markInvalidationStart();
		markInvalidationEnd();

		expect(mark).toHaveBeenCalledWith(
			'perf:socket:arrival:gaf_chat.message_new'
		);
		expect(mark).toHaveBeenCalledWith('perf:invalidation:start');
		expect(mark).toHaveBeenCalledWith('perf:invalidation:end');
		expect(measure).toHaveBeenCalledWith(
			'perf:invalidation',
			expect.objectContaining({ start: expect.any(Number) })
		);
	});

	it('exposes console helpers on window', () => {
		ensureDesktopRealtimePerfConsoleInstalled();
		expect(typeof window.__eliteewSetPerfMode).toBe('function');
		expect(typeof window.__eliteewDesktopSocketStorm).toBe('function');
	});
});
