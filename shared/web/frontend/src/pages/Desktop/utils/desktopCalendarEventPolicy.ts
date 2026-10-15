/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure CalendarApp policy: event draft bounds, list range, month/week cells.
 *
 * Invariants:
 * - Widget slot type `calendar` is forbidden (agenda stays plan due dates).
 * - No third-party calendar grid library.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 */

export const CALENDAR_TITLE_MAX = 200;
export const CALENDAR_NOTES_MAX = 4000;
export const CALENDAR_RANGE_MAX_DAYS = 93;
export const FORBIDDEN_WIDGET_SLOT_TYPE = 'calendar' as const;

export type CalendarEventLike = {
	starts_at: string;
	ends_at: string;
};

export type CalendarGridCell = {
	date: Date;
	inMonth: boolean;
};

export type CalendarDraftIssue =
	| 'title_required'
	| 'title_too_long'
	| 'notes_too_long'
	| 'invalid_interval';

const HAS_EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse a calendar instant. Naive ISO (no Z/offset) is UTC — Postgres stores
 * UTC-naive timestamps; browsers otherwise treat that as local wall time.
 */
export function parseCalendarInstant(iso: string): Date | null {
	const trimmed = iso.trim();
	if (!trimmed) return null;
	const hasTime = trimmed.includes('T');
	const normalized =
		hasTime && !HAS_EXPLICIT_OFFSET.test(trimmed) ? `${trimmed}Z` : trimmed;
	const parsed = new Date(normalized);
	return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function parseCalendarInstantMs(iso: string): number {
	return parseCalendarInstant(iso)?.getTime() ?? Number.NaN;
}

export function localDayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function mondayOfWeek(date: Date): Date {
	const start = startOfLocalDay(date);
	const mondayOffset = (start.getDay() + 6) % 7;
	return addLocalDays(start, -mondayOffset);
}

export function buildMonthGridCells(
	year: number,
	monthIndex: number
): CalendarGridCell[] {
	const first = new Date(year, monthIndex, 1);
	const mondayOffset = (first.getDay() + 6) % 7;
	const gridStart = addLocalDays(first, -mondayOffset);
	const cells: CalendarGridCell[] = [];
	for (let index = 0; index < 42; index += 1) {
		const date = addLocalDays(gridStart, index);
		cells.push({ date, inMonth: date.getMonth() === monthIndex });
	}
	return cells;
}

export function buildWeekDays(anchor: Date): Date[] {
	const monday = mondayOfWeek(anchor);
	return Array.from({ length: 7 }, (_, index) => addLocalDays(monday, index));
}

export function monthQueryRange(
	year: number,
	monthIndex: number
): { from: string; to: string } {
	const cells = buildMonthGridCells(year, monthIndex);
	const first = cells[0]?.date;
	const last = cells[cells.length - 1]?.date;
	if (!first || !last) {
		const fallback = new Date(year, monthIndex, 1);
		return {
			from: fallback.toISOString(),
			to: addLocalDays(fallback, 32).toISOString(),
		};
	}
	return {
		from: startOfLocalDay(first).toISOString(),
		to: addLocalDays(startOfLocalDay(last), 1).toISOString(),
	};
}

export function weekQueryRange(anchor: Date): { from: string; to: string } {
	const monday = mondayOfWeek(anchor);
	return {
		from: startOfLocalDay(monday).toISOString(),
		to: addLocalDays(monday, 7).toISOString(),
	};
}

export function eventOverlapsLocalDay(
	event: CalendarEventLike,
	day: Date
): boolean {
	const dayStart = startOfLocalDay(day).getTime();
	const dayEnd = dayStart + 86_400_000;
	const start = parseCalendarInstantMs(event.starts_at);
	const end = parseCalendarInstantMs(event.ends_at);
	if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
	return start < dayEnd && end > dayStart;
}

export function localDayKeyFromIso(iso: string): string | null {
	const parsed = parseCalendarInstant(iso);
	if (!parsed) return null;
	return localDayKey(parsed);
}

export function eventSpansMultipleLocalDays(event: CalendarEventLike): boolean {
	const startKey = localDayKeyFromIso(event.starts_at);
	const endKey = localDayKeyFromIso(event.ends_at);
	if (!startKey || !endKey) return false;
	return startKey !== endKey;
}

export function isEventContinuationOnLocalDay(
	event: CalendarEventLike,
	day: Date
): boolean {
	const start = parseCalendarInstantMs(event.starts_at);
	if (!Number.isFinite(start)) return false;
	return start < startOfLocalDay(day).getTime();
}

export function eventDurationMs(event: CalendarEventLike): number | null {
	const start = parseCalendarInstantMs(event.starts_at);
	const end = parseCalendarInstantMs(event.ends_at);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return null;
	}
	return end - start;
}

export function shiftEventIntervalToLocalDay(
	event: CalendarEventLike & { all_day?: boolean },
	targetDay: Date
): { starts_at: string; ends_at: string } | null {
	const start = parseCalendarInstant(event.starts_at);
	const end = parseCalendarInstant(event.ends_at);
	if (!start || !end) {
		return null;
	}
	const durationMs = end.getTime() - start.getTime();
	if (durationMs <= 0) return null;

	if (event.all_day) {
		const dayStart = startOfLocalDay(targetDay);
		const dayEnd = new Date(
			targetDay.getFullYear(),
			targetDay.getMonth(),
			targetDay.getDate(),
			23,
			59,
			0,
			0
		);
		return { starts_at: dayStart.toISOString(), ends_at: dayEnd.toISOString() };
	}

	const newStart = new Date(
		targetDay.getFullYear(),
		targetDay.getMonth(),
		targetDay.getDate(),
		start.getHours(),
		start.getMinutes(),
		start.getSeconds(),
		start.getMilliseconds()
	);
	return {
		starts_at: newStart.toISOString(),
		ends_at: new Date(newStart.getTime() + durationMs).toISOString(),
	};
}

export function timedEventsOverlapOnDay(
	a: CalendarEventLike & { all_day?: boolean },
	b: CalendarEventLike & { all_day?: boolean },
	day: Date
): boolean {
	if (a.all_day || b.all_day) return false;
	if (!eventOverlapsLocalDay(a, day) || !eventOverlapsLocalDay(b, day)) {
		return false;
	}
	const startA = parseCalendarInstantMs(a.starts_at);
	const endA = parseCalendarInstantMs(a.ends_at);
	const startB = parseCalendarInstantMs(b.starts_at);
	const endB = parseCalendarInstantMs(b.ends_at);
	if (
		!Number.isFinite(startA) ||
		!Number.isFinite(endA) ||
		!Number.isFinite(startB) ||
		!Number.isFinite(endB)
	) {
		return false;
	}
	return startA < endB && startB < endA;
}

export type EventRelativeStatus = 'upcoming' | 'in_progress' | 'ended';

export function resolveEventRelativeStatus(
	event: CalendarEventLike & { all_day?: boolean },
	now: Date
): EventRelativeStatus | null {
	if (event.all_day) return null;
	const start = parseCalendarInstantMs(event.starts_at);
	const end = parseCalendarInstantMs(event.ends_at);
	const nowMs = now.getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
	if (nowMs < start) return 'upcoming';
	if (nowMs >= end) return 'ended';
	return 'in_progress';
}

export function validateCalendarDraft(input: {
	title: string;
	notes: string;
	startsAt: string;
	endsAt: string;
}): CalendarDraftIssue | null {
	const title = input.title.trim();
	if (!title) return 'title_required';
	if (title.length > CALENDAR_TITLE_MAX) return 'title_too_long';
	if (input.notes.trim().length > CALENDAR_NOTES_MAX) return 'notes_too_long';
	const start = parseCalendarInstantMs(input.startsAt);
	const end = parseCalendarInstantMs(input.endsAt);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
		return 'invalid_interval';
	}
	return null;
}

export function isForbiddenWidgetCalendarSlot(type: string): boolean {
	return type === FORBIDDEN_WIDGET_SLOT_TYPE;
}

export function normalizeCalendarInstantIso(iso: string): string {
	return parseCalendarInstant(iso)?.toISOString() ?? iso;
}
