/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locale format helpers for CalendarApp labels and datetime fields.
 *
 * Related:
 * - CalendarApp.tsx
 * - CalendarDateTimeField.tsx
 */

import type { DesktopCalendarEventResponse } from '../../services/desktopApi';
import {
	buildWeekDays,
	eventOverlapsLocalDay,
	parseCalendarInstant,
	parseCalendarInstantMs,
	resolveEventRelativeStatus,
} from '../../utils/desktopCalendarEventPolicy';

export function calendarEventAccentHue(eventId: string): number {
	let hash = 0;
	for (let index = 0; index < eventId.length; index += 1) {
		hash = (hash * 31 + eventId.charCodeAt(index)) >>> 0;
	}
	return hash % 360;
}

export function calendarEventAccentStyle(eventId: string): {
	backgroundColor: string;
	borderLeftColor: string;
} {
	if (eventId.startsWith('assistant-plan:')) {
		return {
			backgroundColor: 'hsl(198 72% 42% / 0.18)',
			borderLeftColor: 'hsl(198 72% 38%)',
		};
	}
	const hue = calendarEventAccentHue(eventId);
	return {
		backgroundColor: `hsl(${hue} 62% 42% / 0.16)`,
		borderLeftColor: `hsl(${hue} 62% 38%)`,
	};
}

export function calendarEventAccentBorderStyle(eventId: string): {
	borderLeftColor: string;
} {
	return {
		borderLeftColor: calendarEventAccentStyle(eventId).borderLeftColor,
	};
}

export function endIsoFromStartAndDurationMinutes(
	startIso: string,
	durationMinutes: number
): string | null {
	const startMs = parseCalendarInstantMs(startIso);
	if (!Number.isFinite(startMs) || durationMinutes <= 0) return null;
	return new Date(startMs + durationMinutes * 60_000).toISOString();
}

export function formatEventChipLabel(
	event: Pick<DesktopCalendarEventResponse, 'title' | 'all_day' | 'starts_at'>,
	locale: string,
	options?: { continuedLabel?: string; isContinuation?: boolean }
): string {
	const time = formatEventTime(event, locale);
	const prefix = options?.isContinuation
		? `${options.continuedLabel ?? '↳'} `
		: '';
	const title = time ? `${time} ${event.title}` : event.title;
	return `${prefix}${title}`;
}

export function isCalendarTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest('input, textarea, select, [contenteditable="true"]')
	);
}

export function filterCalendarEventsByQuery(
	events: readonly DesktopCalendarEventResponse[],
	query: string
): DesktopCalendarEventResponse[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...events];
	return events.filter((event) => {
		const haystack = `${event.title}\n${event.notes ?? ''}`.toLowerCase();
		return haystack.includes(needle);
	});
}

export function findTodayHighlightEvent(
	events: readonly DesktopCalendarEventResponse[],
	day: Date,
	now: Date
): DesktopCalendarEventResponse | null {
	const sorted = sortCalendarEventsByStart(
		events.filter((event) => eventOverlapsLocalDay(event, day))
	);
	if (sorted.length === 0) return null;
	const nowMs = now.getTime();
	const inProgress = sorted.find((event) => {
		if (event.all_day) return false;
		const start = parseCalendarInstantMs(event.starts_at);
		const end = parseCalendarInstantMs(event.ends_at);
		return (
			Number.isFinite(start) &&
			Number.isFinite(end) &&
			start <= nowMs &&
			end > nowMs
		);
	});
	if (inProgress) return inProgress;
	const upcoming = sorted.find((event) => {
		if (event.all_day) return false;
		const start = parseCalendarInstantMs(event.starts_at);
		return Number.isFinite(start) && start > nowMs;
	});
	if (upcoming) return upcoming;
	return sorted[0] ?? null;
}

export function formatHighlightEventLabel(
	event: DesktopCalendarEventResponse,
	now: Date,
	locale: string,
	labels: {
		inProgress: string;
		upcoming: (minutes: number) => string;
		allDay: string;
	}
): string {
	if (event.all_day) return `${event.title} · ${labels.allDay}`;
	const status = resolveEventRelativeStatus(event, now);
	if (status === 'in_progress') {
		return `${event.title} · ${labels.inProgress}`;
	}
	if (status === 'upcoming') {
		const start = parseCalendarInstantMs(event.starts_at);
		const minutes = Number.isFinite(start)
			? Math.max(1, Math.round((start - now.getTime()) / 60_000))
			: 1;
		return `${event.title} · ${labels.upcoming(minutes)}`;
	}
	const schedule = formatEventScheduleLabel(event, locale, labels.allDay);
	return schedule ? `${event.title} · ${schedule}` : event.title;
}

export function formatSelectedDayHeading(date: Date, locale: string): string {
	return date.toLocaleDateString(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
}

export function formatMonthYear(date: Date, locale: string): string {
	return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function formatWeekRange(anchor: Date, locale: string): string {
	const days = buildWeekDays(anchor);
	const start = days[0];
	const end = days[days.length - 1];
	if (!start || !end) return formatMonthYear(anchor, locale);
	const sameMonth = start.getMonth() === end.getMonth();
	const sameYear = start.getFullYear() === end.getFullYear();
	if (sameMonth && sameYear) {
		return `${start.toLocaleDateString(locale, { day: 'numeric' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
	}
	if (sameYear) {
		return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
	}
	return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function formatToolbarPeriodLabel(
	view: 'month' | 'week',
	anchor: Date,
	locale: string
): string {
	return view === 'week'
		? formatWeekRange(anchor, locale)
		: formatMonthYear(anchor, locale);
}

export function clampDayToMonth(
	day: Date,
	year: number,
	monthIndex: number
): Date {
	const lastDay = new Date(year, monthIndex + 1, 0).getDate();
	return new Date(year, monthIndex, Math.min(day.getDate(), lastDay));
}

export function formatEventTime(
	event: { all_day: boolean; starts_at: string },
	locale: string
): string {
	if (event.all_day) return '';
	const parsed = parseCalendarInstant(event.starts_at);
	if (!parsed) return '';
	return parsed.toLocaleTimeString(locale, {
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function formatEventScheduleLabel(
	event: Pick<
		DesktopCalendarEventResponse,
		'all_day' | 'starts_at' | 'ends_at'
	>,
	locale: string,
	allDayLabel: string
): string {
	if (event.all_day) return allDayLabel;
	const start = parseCalendarInstant(event.starts_at);
	const end = parseCalendarInstant(event.ends_at);
	if (!start || !end) {
		return '';
	}
	const startLabel = start.toLocaleTimeString(locale, {
		hour: '2-digit',
		minute: '2-digit',
	});
	const endLabel = end.toLocaleTimeString(locale, {
		hour: '2-digit',
		minute: '2-digit',
	});
	return `${startLabel} – ${endLabel}`;
}

export function sortCalendarEventsByStart(
	events: readonly DesktopCalendarEventResponse[]
): DesktopCalendarEventResponse[] {
	return [...events].sort((a, b) => {
		if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
		const startA = parseCalendarInstantMs(a.starts_at);
		const startB = parseCalendarInstantMs(b.starts_at);
		if (
			Number.isFinite(startA) &&
			Number.isFinite(startB) &&
			startA !== startB
		) {
			return startA - startB;
		}
		return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
	});
}

export function truncateNotesPreview(notes: string, max = 72): string {
	const trimmed = notes.trim();
	if (!trimmed) return '';
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatDateTimeFieldLabel(iso: string, locale: string): string {
	const date = parseCalendarInstant(iso);
	if (!date) return '—';
	return date.toLocaleString(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function mergeLocalDateWithTime(
	dateSource: Date,
	timeSource: Date
): Date {
	return new Date(
		dateSource.getFullYear(),
		dateSource.getMonth(),
		dateSource.getDate(),
		timeSource.getHours(),
		timeSource.getMinutes(),
		0,
		0
	);
}
