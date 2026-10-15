/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	ASSISTANT_PLAN_CALENDAR_ID_PREFIX,
	assistantPlanTaskIdFromCalendarId,
	calendarDraftToCompanionPlanTaskPatch,
	companionPlanTasksToCalendarEvents,
	isAssistantPlanCalendarItem,
	mergeCalendarEventsWithCompanionPlanTasks,
} from '../companionPlanCalendarOverlay';
import type { EwaCompanionPlanTask } from '@/services/ewa/ewaCompanionPlansApi';

function planTask(
	partial: Pick<EwaCompanionPlanTask, 'id' | 'title' | 'status'> &
		Partial<EwaCompanionPlanTask>
): EwaCompanionPlanTask {
	return {
		plan_id: 'plan-1',
		priority: 'normal',
		sort_order: 0,
		...partial,
	};
}

describe('companionPlanCalendarOverlay', () => {
	it('maps open plan tasks with due_date to all-day calendar items', () => {
		const events = companionPlanTasksToCalendarEvents([
			planTask({
				id: 'task-1',
				title: 'Research day 1',
				status: 'pending',
				due_date: '2026-08-19',
			}),
		]);
		expect(events).toHaveLength(1);
		expect(events[0]?.id).toBe(`${ASSISTANT_PLAN_CALENDAR_ID_PREFIX}task-1`);
		expect(events[0]?.all_day).toBe(true);
	});

	it('maps plan description onto calendar notes', () => {
		const events = companionPlanTasksToCalendarEvents([
			planTask({
				id: 'task-notes',
				title: 'Research',
				status: 'pending',
				due_date: '2026-08-19',
				description: 'Bring the brief',
			}),
		]);
		expect(events[0]?.notes).toBe('Bring the brief');
	});

	it('extracts plan task id from overlay event id', () => {
		expect(assistantPlanTaskIdFromCalendarId('assistant-plan:task-9')).toBe(
			'task-9'
		);
		expect(assistantPlanTaskIdFromCalendarId('evt-1')).toBeNull();
	});

	it('maps a timed calendar draft back to a plan task patch', () => {
		const start = new Date(2026, 7, 19, 10, 0, 0);
		const end = new Date(2026, 7, 19, 11, 30, 0);
		const patch = calendarDraftToCompanionPlanTaskPatch({
			title: 'Morning sprint',
			notes: 'Focus block',
			starts_at: start.toISOString(),
			ends_at: end.toISOString(),
			all_day: false,
		});
		expect(patch?.due_date).toBe('2026-08-19');
		expect(patch?.due_time).toBe('10:00:00');
		expect(patch?.due_duration_minutes).toBe(90);
		expect(patch?.all_day).toBe(false);
	});

	it('maps plan tasks with due_time to timed calendar slots', () => {
		const events = companionPlanTasksToCalendarEvents([
			planTask({
				id: 'task-2',
				title: 'Morning sprint',
				status: 'pending',
				due_date: '2026-08-19',
				due_time: '10:00:00',
				due_duration_minutes: 90,
			}),
		]);
		expect(events).toHaveLength(1);
		expect(events[0]?.all_day).toBe(false);
		const start = new Date(events[0]?.starts_at ?? '');
		expect(start.getHours()).toBe(10);
		expect(start.getMinutes()).toBe(0);
		const end = new Date(events[0]?.ends_at ?? '');
		expect(end.getTime() - start.getTime()).toBe(90 * 60 * 1000);
	});

	it('merges plan overlay with personal events without duplicates', () => {
		const merged = mergeCalendarEventsWithCompanionPlanTasks(
			[
				{
					id: 'evt-1',
					title: 'Meeting',
					notes: '',
					starts_at: '2026-08-19T09:00:00.000Z',
					ends_at: '2026-08-19T10:00:00.000Z',
					all_day: false,
					created_at: '2026-08-19T09:00:00.000Z',
					updated_at: '2026-08-19T09:00:00.000Z',
				},
			],
			[
				planTask({
					id: 'task-1',
					title: 'Research day 1',
					status: 'pending',
					due_date: '2026-08-19',
				}),
			]
		);
		expect(merged).toHaveLength(2);
		expect(merged.some((event) => isAssistantPlanCalendarItem(event.id))).toBe(
			true
		);
	});

	it('keeps two same-title plan steps on the same day as separate chips', () => {
		const merged = mergeCalendarEventsWithCompanionPlanTasks(
			[],
			[
				planTask({
					id: 'task-a',
					title: 'Research',
					status: 'pending',
					due_date: '2026-08-19',
				}),
				planTask({
					id: 'task-b',
					title: 'Research',
					status: 'pending',
					due_date: '2026-08-19',
				}),
			]
		);
		expect(merged).toHaveLength(2);
		expect(merged.map((event) => event.id)).toEqual([
			`${ASSISTANT_PLAN_CALENDAR_ID_PREFIX}task-a`,
			`${ASSISTANT_PLAN_CALENDAR_ID_PREFIX}task-b`,
		]);
	});
});
