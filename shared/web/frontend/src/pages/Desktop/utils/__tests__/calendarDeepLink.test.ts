/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	consumeCalendarSelectedDayDeepLink,
	parseCalendarDayKey,
	requestOpenCalendarApp,
} from '../calendarDeepLink';

describe('calendarDeepLink', () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.stubGlobal(
			'dispatchEvent',
			vi.fn(() => true)
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('stores selected day and dispatches desktop-open-app', () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		requestOpenCalendarApp({ selectedDay: new Date(2026, 7, 19) });
		expect(sessionStorage.getItem('eliteew.desktop.deepLink.calendarSelectedDay')).toBe(
			'2026-08-19'
		);
		expect(dispatchSpy).toHaveBeenCalled();
	});

	it('consumeCalendarSelectedDayDeepLink read-and-clears', () => {
		sessionStorage.setItem(
			'eliteew.desktop.deepLink.calendarSelectedDay',
			'2026-08-25'
		);
		expect(consumeCalendarSelectedDayDeepLink()).toBe('2026-08-25');
		expect(
			sessionStorage.getItem('eliteew.desktop.deepLink.calendarSelectedDay')
		).toBeNull();
	});

	it('parseCalendarDayKey validates calendar dates', () => {
		expect(parseCalendarDayKey('2026-08-19')?.getDate()).toBe(19);
		expect(parseCalendarDayKey('invalid')).toBeNull();
	});
});
