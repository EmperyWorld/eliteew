/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for CalendarApp formatting helpers.
 */

import { describe, expect, it } from 'vitest';
import {
	calendarEventAccentHue,
	clampDayToMonth,
	endIsoFromStartAndDurationMinutes,
	filterCalendarEventsByQuery,
	findTodayHighlightEvent,
	formatEventChipLabel,
	formatEventScheduleLabel,
	sortCalendarEventsByStart,
} from '../calendarAppFormatting';

describe('calendarAppFormatting', () => {
	it('sorts events by start time with all-day first', () => {
		const sorted = sortCalendarEventsByStart([
			{
				id: 'b',
				title: 'Later',
				notes: '',
				all_day: false,
				starts_at: '2026-08-19T14:00:00.000Z',
				ends_at: '2026-08-19T15:00:00.000Z',
				created_at: '',
				updated_at: '',
			},
			{
				id: 'a',
				title: 'All day',
				notes: '',
				all_day: true,
				starts_at: '2026-08-19T00:00:00.000Z',
				ends_at: '2026-08-19T23:59:00.000Z',
				created_at: '',
				updated_at: '',
			},
			{
				id: 'c',
				title: 'Morning',
				notes: '',
				all_day: false,
				starts_at: '2026-08-19T08:00:00.000Z',
				ends_at: '2026-08-19T09:00:00.000Z',
				created_at: '',
				updated_at: '',
			},
		]);
		expect(sorted.map((event) => event.id)).toEqual(['a', 'c', 'b']);
	});

	it('clamps day when shifting to shorter month', () => {
		const march31 = new Date(2026, 2, 31);
		const february = clampDayToMonth(march31, 2026, 1);
		expect(february.getMonth()).toBe(1);
		expect(february.getDate()).toBe(28);
	});

	it('formats timed schedule as start–end', () => {
		const label = formatEventScheduleLabel(
			{
				all_day: false,
				starts_at: '2026-08-19T09:00:00.000Z',
				ends_at: '2026-08-19T10:30:00.000Z',
			},
			'en',
			'All day'
		);
		expect(label).toMatch(/–/);
		expect(label).not.toBe('All day');
	});

	it('derives stable accent hue from event id', () => {
		expect(calendarEventAccentHue('event-a')).toBe(
			calendarEventAccentHue('event-a')
		);
		expect(calendarEventAccentHue('event-a')).not.toBe(
			calendarEventAccentHue('event-b')
		);
	});

	it('extends end time from start and duration minutes', () => {
		const end = endIsoFromStartAndDurationMinutes(
			'2026-08-19T09:00:00.000Z',
			60
		);
		expect(end).toBe('2026-08-19T10:00:00.000Z');
	});

	it('builds chip label with time prefix for timed events', () => {
		const label = formatEventChipLabel(
			{
				title: 'Standup',
				all_day: false,
				starts_at: '2026-08-19T09:00:00.000Z',
			},
			'en'
		);
		expect(label).toContain('Standup');
	});

	it('filters events by title and notes', () => {
		const events = [
			{
				id: 'a',
				title: 'Team sync',
				notes: 'Zoom link',
				all_day: false,
				starts_at: '2026-08-19T09:00:00.000Z',
				ends_at: '2026-08-19T10:00:00.000Z',
				created_at: '',
				updated_at: '',
			},
			{
				id: 'b',
				title: 'Lunch',
				notes: '',
				all_day: false,
				starts_at: '2026-08-19T12:00:00.000Z',
				ends_at: '2026-08-19T13:00:00.000Z',
				created_at: '',
				updated_at: '',
			},
		];
		expect(filterCalendarEventsByQuery(events, 'zoom')).toHaveLength(1);
		expect(filterCalendarEventsByQuery(events, '')).toHaveLength(2);
	});

	it('prefers in-progress event for today highlight', () => {
		const now = new Date(2026, 7, 19, 10, 0);
		const events = [
			{
				id: 'later',
				title: 'Later',
				notes: '',
				all_day: false,
				starts_at: new Date(2026, 7, 19, 15, 0).toISOString(),
				ends_at: new Date(2026, 7, 19, 16, 0).toISOString(),
				created_at: '',
				updated_at: '',
			},
			{
				id: 'now',
				title: 'Now',
				notes: '',
				all_day: false,
				starts_at: new Date(2026, 7, 19, 9, 30).toISOString(),
				ends_at: new Date(2026, 7, 19, 11, 0).toISOString(),
				created_at: '',
				updated_at: '',
			},
		];
		const highlight = findTodayHighlightEvent(
			events,
			new Date(2026, 7, 19),
			now
		);
		expect(highlight?.id).toBe('now');
	});
});
