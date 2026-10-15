/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion plan strip helpers (FSM status + task partition).
 *
 * Related:
 * - src/features/ewa/companionPlanStripUi.ts
 */
import { describe, expect, it } from 'vitest';
import {
	companionPlanStatusDotClass,
	companionPlanStatusIconId,
	isCompanionPlanTaskCompleted,
	isCompanionPlanTaskOverdue,
	normalizeCompanionPlanStatus,
	parseCompanionPlanDueDate,
	partitionCompanionPlanTasks,
	resolveCompanionPlanDisplayProgress,
	resolveCompanionPlanGoalProgress,
} from '../companionPlanStripUi';
import { isEwaIconId } from '../ewaIcons/ewaIconCatalog';

describe('companionPlanStripUi', () => {
	it('normalizes known FSM statuses', () => {
		expect(normalizeCompanionPlanStatus('progress')).toBe('progress');
		expect(normalizeCompanionPlanStatus('unknown')).toBe('wait');
	});

	it('partitions open vs completed tasks by sort_order', () => {
		const { open, done } = partitionCompanionPlanTasks([
			{
				id: 't2',
				plan_id: 'p',
				title: 'B',
				status: 'pending',
				priority: 'medium',
				sort_order: 1,
			},
			{
				id: 't1',
				plan_id: 'p',
				title: 'A',
				status: 'completed',
				priority: 'medium',
				sort_order: 0,
			},
		]);
		expect(open.map((t) => t.id)).toEqual(['t2']);
		expect(done.map((t) => t.id)).toEqual(['t1']);
		expect(done[0] && isCompanionPlanTaskCompleted(done[0])).toBe(true);
	});

	it('maps plan FSM to sprite ids', () => {
		expect(companionPlanStatusIconId('wait')).toBe('icon-loading');
		expect(companionPlanStatusIconId('progress')).toBe('icon-processing');
		expect(companionPlanStatusIconId('finish')).toBe('icon-success');
	});

	it('uses companion aura for wait status dot fallback', () => {
		expect(companionPlanStatusDotClass('wait', false)).toBe(
			'bg-(--companion-aura)'
		);
	});

	it('marks overdue open tasks with past due_date', () => {
		const now = new Date(2026, 7, 19, 15, 0, 0);
		const overdue = isCompanionPlanTaskOverdue(
			{
				id: 't1',
				plan_id: 'p',
				title: 'Late',
				status: 'pending',
				priority: 'medium',
				sort_order: 0,
				due_date: '2020-01-01',
			},
			now
		);
		expect(overdue).toBe(true);
		expect(
			isCompanionPlanTaskOverdue(
				{
					id: 't2',
					plan_id: 'p',
					title: 'Done',
					status: 'completed',
					priority: 'medium',
					sort_order: 0,
					due_date: '2020-01-01',
				},
				now
			)
		).toBe(false);
	});

	it('does not mark tasks due today as overdue', () => {
		const now = new Date(2026, 7, 19, 15, 0, 0);
		expect(
			isCompanionPlanTaskOverdue(
				{
					id: 't-today',
					plan_id: 'p',
					title: 'Today step',
					status: 'pending',
					priority: 'medium',
					sort_order: 0,
					due_date: '2026-08-19',
				},
				now
			)
		).toBe(false);
	});

	it('parses YYYY-MM-DD due dates as local calendar days', () => {
		const due = parseCompanionPlanDueDate('2026-08-19');
		expect(due?.getFullYear()).toBe(2026);
		expect(due?.getMonth()).toBe(7);
		expect(due?.getDate()).toBe(19);
	});

	it('returns zero progress when plan object is missing', () => {
		expect(
			resolveCompanionPlanDisplayProgress({
				plan: undefined as unknown as never,
				goals: [],
				tasks: [
					{
						id: 'a',
						plan_id: 'p',
						title: 'A',
						status: 'completed',
						priority: 'medium',
						sort_order: 0,
					},
				],
			})
		).toBe(0);
		expect(resolveCompanionPlanDisplayProgress(null)).toBe(0);
	});

	it('derives goal progress from linked tasks', () => {
		const goal = {
			id: 'g1',
			plan_id: 'p',
			title: 'Goal',
			category: 'general',
			progress: 0,
			status: 'active',
			priority: 'medium',
			sort_order: 0,
		};
		const tasks = [
			{
				id: 't1',
				plan_id: 'p',
				goal_id: 'g1',
				title: 'A',
				status: 'completed',
				priority: 'medium',
				sort_order: 0,
			},
			{
				id: 't2',
				plan_id: 'p',
				goal_id: 'g1',
				title: 'B',
				status: 'pending',
				priority: 'medium',
				sort_order: 1,
			},
		];
		expect(resolveCompanionPlanGoalProgress(goal, tasks)).toBe(50);
	});
});

describe('ewaIconCatalog', () => {
	it('validates known sprite ids', () => {
		expect(isEwaIconId('icon-ewa-brain')).toBe(true);
		expect(isEwaIconId('icon-not-real')).toBe(false);
	});
});
