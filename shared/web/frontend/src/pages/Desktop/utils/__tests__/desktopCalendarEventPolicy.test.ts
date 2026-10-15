/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for CalendarApp policy: interval, month grid, forbidden widget slot.
 *
 * Related:
 * - ../desktopCalendarEventPolicy.ts
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_WIDGET_SLOT_TYPE,
	buildMonthGridCells,
	eventOverlapsLocalDay,
	isEventContinuationOnLocalDay,
	isForbiddenWidgetCalendarSlot,
	localDayKey,
	mondayOfWeek,
	parseCalendarInstant,
	parseCalendarInstantMs,
	shiftEventIntervalToLocalDay,
	timedEventsOverlapOnDay,
	validateCalendarDraft,
} from '../desktopCalendarEventPolicy';

describe('desktopCalendarEventPolicy', () => {
	it('forbids a calendar widget slot type', () => {
		expect(FORBIDDEN_WIDGET_SLOT_TYPE).toBe('calendar');
		expect(isForbiddenWidgetCalendarSlot('calendar')).toBe(true);
		expect(isForbiddenWidgetCalendarSlot('agenda')).toBe(false);
	});

	it('rejects empty title and inverted interval', () => {
		expect(
			validateCalendarDraft({
				title: '  ',
				notes: '',
				startsAt: '2026-08-19T09:00:00.000Z',
				endsAt: '2026-08-19T10:00:00.000Z',
			})
		).toBe('title_required');
		expect(
			validateCalendarDraft({
				title: 'Call',
				notes: '',
				startsAt: '2026-08-19T10:00:00.000Z',
				endsAt: '2026-08-19T09:00:00.000Z',
			})
		).toBe('invalid_interval');
	});

	it('builds a Monday-first 42-cell month grid', () => {
		const cells = buildMonthGridCells(2026, 7);
		expect(cells).toHaveLength(42);
		expect(mondayOfWeek(cells[0].date).getDay()).toBe(1);
		expect(
			cells.some((cell) => cell.inMonth && cell.date.getDate() === 1)
		).toBe(true);
	});

	it('counts an event on each overlapping local day', () => {
		const event = {
			starts_at: '2026-08-19T22:00:00.000Z',
			ends_at: '2026-08-20T02:00:00.000Z',
		};
		const dayA = new Date(2026, 7, 19);
		const dayB = new Date(2026, 7, 20);
		const dayC = new Date(2026, 7, 21);
		expect(localDayKey(dayA)).toBe('2026-08-19');
		expect(
			eventOverlapsLocalDay(event, dayA) || eventOverlapsLocalDay(event, dayB)
		).toBe(true);
		expect(eventOverlapsLocalDay(event, dayC)).toBe(false);
	});

	it('shifts timed events to another day preserving clock time and duration', () => {
		const start = new Date(2026, 7, 19, 9, 0);
		const end = new Date(2026, 7, 19, 10, 30);
		const shifted = shiftEventIntervalToLocalDay(
			{
				starts_at: start.toISOString(),
				ends_at: end.toISOString(),
				all_day: false,
			},
			new Date(2026, 7, 22)
		);
		expect(shifted).not.toBeNull();
		const shiftedStart = new Date(shifted?.starts_at ?? '');
		const shiftedEnd = new Date(shifted?.ends_at ?? '');
		expect(shiftedStart.getDate()).toBe(22);
		expect(shiftedEnd.getTime() - shiftedStart.getTime()).toBe(90 * 60_000);
	});

	it('marks continuation days for multi-day events', () => {
		const event = {
			starts_at: new Date(2026, 7, 19, 9, 0).toISOString(),
			ends_at: new Date(2026, 7, 21, 9, 0).toISOString(),
		};
		expect(isEventContinuationOnLocalDay(event, new Date(2026, 7, 20))).toBe(
			true
		);
		expect(isEventContinuationOnLocalDay(event, new Date(2026, 7, 19))).toBe(
			false
		);
	});

	it('detects timed overlap on the same day', () => {
		const day = new Date(2026, 7, 19);
		const a = {
			all_day: false,
			starts_at: new Date(2026, 7, 19, 9, 0).toISOString(),
			ends_at: new Date(2026, 7, 19, 10, 0).toISOString(),
		};
		const b = {
			all_day: false,
			starts_at: new Date(2026, 7, 19, 9, 30).toISOString(),
			ends_at: new Date(2026, 7, 19, 11, 0).toISOString(),
		};
		expect(timedEventsOverlapOnDay(a, b, day)).toBe(true);
	});

	it('treats naive ISO timestamps as UTC instants', () => {
		expect(parseCalendarInstantMs('2026-08-19T02:00:00')).toBe(
			parseCalendarInstantMs('2026-08-19T02:00:00.000Z')
		);
		expect(parseCalendarInstant('2026-08-19T02:00:00')?.toISOString()).toBe(
			'2026-08-19T02:00:00.000Z'
		);
	});
});
