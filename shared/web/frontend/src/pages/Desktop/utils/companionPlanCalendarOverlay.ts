/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map companion plan tasks with due_date into CalendarApp display items.
 *
 * Invariants:
 * - Assistant plan tasks stay SoT in companion-plans; calendar edits them via PATCH, never as personal events.
 * - Synthetic ids use ``assistant-plan:`` prefix (not persisted calendar events).
 * - Overlay merge keys by event id (two same-title steps on one day stay two chips).
 * - When due_time is set, tasks render as timed slots; otherwise all-day on due_date.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CALENDAR-APP.md
 * - services/ewa/ewaCompanionPlansApi.ts
 */

import type { EwaCompanionPlanTask } from '@/services/ewa/ewaCompanionPlansApi';
import type { DesktopCalendarEventResponse } from '../services/desktopApi';
import { parseCompanionPlanDueDate } from '@/features/ewa/companionPlanStripUi';
import {
	localDayKey,
	parseCalendarInstant,
	startOfLocalDay,
} from '../utils/desktopCalendarEventPolicy';

export const ASSISTANT_PLAN_CALENDAR_ID_PREFIX = 'assistant-plan:';

export function isAssistantPlanCalendarItem(eventId: string): boolean {
	return eventId.startsWith(ASSISTANT_PLAN_CALENDAR_ID_PREFIX);
}

export function assistantPlanTaskIdFromCalendarId(
	eventId: string
): string | null {
	if (!isAssistantPlanCalendarItem(eventId)) return null;
	const taskId = eventId.slice(ASSISTANT_PLAN_CALENDAR_ID_PREFIX.length).trim();
	return taskId || null;
}

export type CompanionPlanTaskCalendarPatch = {
	title: string;
	description: string;
	due_date: string;
	due_time: string | null;
	due_duration_minutes: number | null;
	all_day: boolean;
};

export function calendarDraftToCompanionPlanTaskPatch(draft: {
	title: string;
	notes: string;
	starts_at: string;
	ends_at: string;
	all_day: boolean;
}): CompanionPlanTaskCalendarPatch | null {
	const start = parseCalendarInstant(draft.starts_at);
	const end = parseCalendarInstant(draft.ends_at);
	if (!start || !end) return null;
	const dueDate = localDayKey(start);
	if (draft.all_day) {
		return {
			title: draft.title.trim(),
			description: draft.notes.trim(),
			due_date: dueDate,
			due_time: null,
			due_duration_minutes: null,
			all_day: true,
		};
	}
	const durationMinutes = Math.round(
		(end.getTime() - start.getTime()) / 60_000
	);
	const hour = String(start.getHours()).padStart(2, '0');
	const minute = String(start.getMinutes()).padStart(2, '0');
	return {
		title: draft.title.trim(),
		description: draft.notes.trim(),
		due_date: dueDate,
		due_time: `${hour}:${minute}:00`,
		due_duration_minutes: Math.max(15, Math.min(durationMinutes, 12 * 60)),
		all_day: false,
	};
}

function parseCompanionPlanDueTime(
	raw: string | null | undefined
): { hour: number; minute: number } | null {
	if (!raw?.trim()) return null;
	const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
	if (!match) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
	return { hour, minute };
}

function planTaskToAllDayInterval(dueDay: Date): {
	starts_at: string;
	ends_at: string;
} {
	const start = startOfLocalDay(dueDay);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	end.setMilliseconds(end.getMilliseconds() - 1);
	return {
		starts_at: start.toISOString(),
		ends_at: end.toISOString(),
	};
}

function planTaskToTimedInterval(
	dueDay: Date,
	dueTime: { hour: number; minute: number },
	durationMinutes: number
): { starts_at: string; ends_at: string } {
	const start = startOfLocalDay(dueDay);
	start.setHours(dueTime.hour, dueTime.minute, 0, 0);
	const end = new Date(start);
	const duration = Math.max(15, Math.min(durationMinutes, 12 * 60));
	end.setMinutes(end.getMinutes() + duration);
	return {
		starts_at: start.toISOString(),
		ends_at: end.toISOString(),
	};
}

export function companionPlanTaskToCalendarEvent(
	task: EwaCompanionPlanTask
): DesktopCalendarEventResponse | null {
	const dueDay = parseCompanionPlanDueDate(task.due_date ?? null);
	if (!dueDay) return null;
	if (task.status === 'completed' || task.status === 'cancelled') return null;
	const dueTime = parseCompanionPlanDueTime(task.due_time ?? null);
	const durationMinutes = task.due_duration_minutes ?? 60;
	const interval =
		dueTime != null
			? planTaskToTimedInterval(dueDay, dueTime, durationMinutes)
			: planTaskToAllDayInterval(dueDay);
	return {
		id: `${ASSISTANT_PLAN_CALENDAR_ID_PREFIX}${task.id}`,
		title: task.title,
		notes: task.description?.trim() ?? '',
		starts_at: interval.starts_at,
		ends_at: interval.ends_at,
		all_day: dueTime == null,
		created_at: interval.starts_at,
		updated_at: interval.starts_at,
	};
}

export function companionPlanTasksToCalendarEvents(
	tasks: readonly EwaCompanionPlanTask[]
): DesktopCalendarEventResponse[] {
	return tasks
		.map((task) => companionPlanTaskToCalendarEvent(task))
		.filter((event): event is DesktopCalendarEventResponse => event != null);
}

export function mergeCalendarEventsWithCompanionPlanTasks(
	events: readonly DesktopCalendarEventResponse[],
	planTasks: readonly EwaCompanionPlanTask[]
): DesktopCalendarEventResponse[] {
	const planEvents = companionPlanTasksToCalendarEvents(planTasks);
	if (!planEvents.length) return [...events];
	const merged = [...events];
	const seenIds = new Set(merged.map((event) => event.id));
	for (const planEvent of planEvents) {
		if (seenIds.has(planEvent.id)) continue;
		seenIds.add(planEvent.id);
		merged.push(planEvent);
	}
	return merged.sort(
		(a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
	);
}
