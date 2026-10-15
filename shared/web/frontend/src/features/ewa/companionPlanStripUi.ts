/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for the EWA companion **active plan** strip: FSM status styling (wait / progress / finish from
 * EWASolution Roadmap Builder) and stable task ordering for read-only UI + checkbox completion.
 *
 * Invariants:
 * - No network I/O; tolerant of missing fields; never throws.
 * - Status keys stay aligned with ``companion/plans/fsm.py`` and ADR ``EWA-COMPANION-SERVER-PLANS-ADR.md``.
 *
 * - **`companionPlanStatusIconId`** maps plan FSM → EWASolution status sprites.
 *
 * Related:
 * - src/services/ewa/ewaCompanionPlansApi.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/ewaIcons/ewaIconCatalog.ts
 */
import type { EwaStatusIconId } from '@/features/ewa/ewaIcons/ewaIconCatalog';
import type { EwaIconTone } from '@/features/ewa/ewaIcons/EwaIcon';
import type {
	EwaCompanionPlanBundle,
	EwaCompanionPlanGoal,
	EwaCompanionPlanTask,
} from '@/services/ewa/ewaCompanionPlansApi';

export type CompanionPlanFsmStatus = 'wait' | 'progress' | 'finish';

const _KNOWN_STATUSES = new Set<CompanionPlanFsmStatus>([
	'wait',
	'progress',
	'finish',
]);

export function normalizeCompanionPlanStatus(
	raw: string | null | undefined
): CompanionPlanFsmStatus {
	const s = (raw ?? '').trim().toLowerCase();
	if (_KNOWN_STATUSES.has(s as CompanionPlanFsmStatus)) {
		return s as CompanionPlanFsmStatus;
	}
	return 'wait';
}

/** i18n key under ``ewaCompanion.planStatus.*``. */
export function companionPlanStatusLabelKey(
	status: CompanionPlanFsmStatus
): `ewaCompanion.planStatus.${CompanionPlanFsmStatus}` {
	return `ewaCompanion.planStatus.${status}`;
}

/** Map plan FSM → EWASolution-style status sprite (``status-icons.svg``). */
export function companionPlanStatusIconId(
	status: CompanionPlanFsmStatus
): EwaStatusIconId {
	switch (status) {
		case 'progress':
			return 'icon-processing';
		case 'finish':
			return 'icon-success';
		default:
			return 'icon-loading';
	}
}

export function companionPlanStatusIconTone(
	status: CompanionPlanFsmStatus
): EwaIconTone {
	switch (status) {
		case 'progress':
			return 'success';
		case 'finish':
			return 'warning';
		default:
			return 'aura';
	}
}

/** Tailwind utility classes for the status dot (legacy fallback). */
export function companionPlanStatusDotClass(
	status: CompanionPlanFsmStatus,
	reducedMotion: boolean
): string {
	switch (status) {
		case 'progress':
			return reducedMotion
				? 'bg-emerald-400/90'
				: 'bg-emerald-400/90 animate-pulse';
		case 'finish':
			return reducedMotion
				? 'bg-amber-300/95'
				: 'bg-amber-300/95 motion-safe:animate-pulse';
		default:
			return 'bg-(--companion-aura)';
	}
}

export function isCompanionPlanTaskCompleted(
	task: EwaCompanionPlanTask
): boolean {
	return (task.status ?? '').trim().toLowerCase() === 'completed';
}

export function sortCompanionPlanTasks(
	tasks: EwaCompanionPlanTask[]
): EwaCompanionPlanTask[] {
	return [...tasks].sort((a, b) => {
		const ao = a.sort_order ?? 0;
		const bo = b.sort_order ?? 0;
		if (ao !== bo) return ao - bo;
		return (a.title ?? '').localeCompare(b.title ?? '', undefined, {
			sensitivity: 'base',
		});
	});
}

export function partitionCompanionPlanTasks(tasks: EwaCompanionPlanTask[]): {
	open: EwaCompanionPlanTask[];
	done: EwaCompanionPlanTask[];
} {
	const sorted = sortCompanionPlanTasks(tasks);
	const open: EwaCompanionPlanTask[] = [];
	const done: EwaCompanionPlanTask[] = [];
	for (const task of sorted) {
		if (isCompanionPlanTaskCompleted(task)) done.push(task);
		else open.push(task);
	}
	return { open, done };
}

export function companionPlanProgressPercent(
	progress: number | null | undefined
): number {
	if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0;
	return Math.max(0, Math.min(100, Math.round(progress)));
}

export function sortCompanionPlanGoals(
	goals: EwaCompanionPlanGoal[]
): EwaCompanionPlanGoal[] {
	return [...goals].sort((a, b) => {
		const ao = a.sort_order ?? 0;
		const bo = b.sort_order ?? 0;
		if (ao !== bo) return ao - bo;
		return (a.title ?? '').localeCompare(b.title ?? '', undefined, {
			sensitivity: 'base',
		});
	});
}

export function companionPlanGoalProgressPercent(
	goal: EwaCompanionPlanGoal
): number {
	return companionPlanProgressPercent(goal.progress);
}

/** Prefer task-linked progress; fall back to server goal.progress when no linked tasks. */
export function resolveCompanionPlanGoalProgress(
	goal: EwaCompanionPlanGoal,
	tasks: EwaCompanionPlanTask[]
): number {
	const linked = tasks.filter((task) => task.goal_id === goal.id);
	if (linked.length === 0) {
		return companionPlanGoalProgressPercent(goal);
	}
	let done = 0;
	for (const task of linked) {
		if (isCompanionPlanTaskCompleted(task)) done += 1;
	}
	return Math.round((done / linked.length) * 100);
}

/** Task-derived percent when server ``plan.progress`` is missing. */
export function companionPlanProgressFromTasks(
	tasks: EwaCompanionPlanTask[]
): number {
	if (tasks.length === 0) return 0;
	let done = 0;
	for (const task of tasks) {
		if (isCompanionPlanTaskCompleted(task)) done += 1;
	}
	return Math.round((done / tasks.length) * 100);
}

export function resolveCompanionPlanDisplayProgress(
	bundle: EwaCompanionPlanBundle | null | undefined
): number {
	if (!bundle?.plan) return 0;
	const fromPlan = companionPlanProgressPercent(bundle.plan.progress);
	if (fromPlan > 0) return fromPlan;
	return companionPlanProgressFromTasks(bundle.tasks ?? []);
}

export function parseCompanionPlanDueDate(
	raw: string | null | undefined
): Date | null {
	const s = (raw ?? '').trim();
	if (!s) return null;
	// PostgreSQL `date` serializes as YYYY-MM-DD; JS parses that as UTC midnight and
	// shifts the calendar day in many timezones — treat as local civil date instead.
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (dateOnly) {
		const year = Number(dateOnly[1]);
		const month = Number(dateOnly[2]) - 1;
		const day = Number(dateOnly[3]);
		const local = new Date(year, month, day);
		return Number.isFinite(local.getTime()) ? local : null;
	}
	const d = new Date(s);
	return Number.isFinite(d.getTime()) ? d : null;
}

function startOfLocalDay(value: Date): Date {
	return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function isCompanionPlanTaskOverdue(
	task: EwaCompanionPlanTask,
	now: Date = new Date()
): boolean {
	if (isCompanionPlanTaskCompleted(task)) return false;
	const due = parseCompanionPlanDueDate(task.due_date);
	if (!due) return false;
	// Calendar-day overdue only — tasks due today stay actionable until tomorrow.
	return startOfLocalDay(due).getTime() < startOfLocalDay(now).getTime();
}
