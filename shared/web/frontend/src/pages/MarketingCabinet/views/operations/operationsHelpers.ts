/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Marketing Cabinet operations tasks/alerts: remediation copy,
 * sort/compare, badge classes, overdue detection, and initial form state.
 *
 * Invariants:
 * - No React or side effects; safe for unit tests and section components.
 *
 * Related:
 * - OperationsView.tsx
 * - OperationsTasksSection.tsx
 * - OperationsAlertsSection.tsx
 */

import { localizeOverviewInsight } from '../../locales';
import type { MarketingAlert, MarketingTask } from '../../marketingCabinetApi';
import type { AlertFormState, TaskFormState } from './operationsTypes';

export const initialTaskForm: TaskFormState = {
	title: '',
	description: '',
	status: 'open',
	priority: 'medium',
	owner_name: '',
	due_at: '',
};

export const initialAlertForm: AlertFormState = {
	title: '',
	description: '',
	severity: 'medium',
	status: 'open',
	owner_name: '',
};

export function getRemediationMetadata(
	metadata?: Record<string, unknown>
): Record<string, unknown> | null {
	const remediation = metadata?.remediation;
	if (
		!remediation ||
		typeof remediation !== 'object' ||
		Array.isArray(remediation)
	) {
		return null;
	}
	return remediation as Record<string, unknown>;
}

export function getLocalizedTaskCopy(
	task: MarketingTask,
	t: (key: string, options?: Record<string, unknown>) => string
): { title: string; description: string | null } {
	const remediation = getRemediationMetadata(task.metadata);
	const issueCode =
		typeof remediation?.issue_code === 'string' ? remediation.issue_code : null;
	if (!issueCode) {
		return { title: task.title, description: task.description || null };
	}

	const fallbackTitle =
		typeof remediation?.issue_title === 'string'
			? remediation.issue_title
			: task.title;
	const fallbackDescription =
		typeof remediation?.issue_description === 'string'
			? remediation.issue_description
			: task.description;
	return {
		title: t('operationsView.remediation.taskTitle', {
			issue: localizeOverviewInsight(issueCode, 'title', fallbackTitle),
		}),
		description: t('operationsView.remediation.taskDescription', {
			issue: localizeOverviewInsight(
				issueCode,
				'description',
				fallbackDescription
			),
		}),
	};
}

export function getLocalizedAlertCopy(
	alert: MarketingAlert,
	t: (key: string, options?: Record<string, unknown>) => string
): { title: string; description: string | null } {
	const remediation = getRemediationMetadata(alert.metadata);
	const issueCode =
		typeof remediation?.issue_code === 'string' ? remediation.issue_code : null;
	if (!issueCode) {
		return { title: alert.title, description: alert.description || null };
	}

	const fallbackTitle =
		typeof remediation?.issue_title === 'string'
			? remediation.issue_title
			: alert.title;
	const fallbackDescription =
		typeof remediation?.issue_description === 'string'
			? remediation.issue_description
			: alert.description;
	return {
		title: t('operationsView.remediation.alertTitle', {
			issue: localizeOverviewInsight(issueCode, 'title', fallbackTitle),
		}),
		description: t('operationsView.remediation.alertDescription', {
			issue: localizeOverviewInsight(
				issueCode,
				'description',
				fallbackDescription
			),
		}),
	};
}

function taskPriorityRank(priority: string | null | undefined): number {
	const v = String(priority || 'medium').toLowerCase();
	const order: Record<string, number> = {
		urgent: 0,
		high: 1,
		medium: 2,
		low: 3,
	};
	return order[v] ?? 2;
}

export function compareTasks(a: MarketingTask, b: MarketingTask): number {
	const completed = (s: string | null | undefined) =>
		String(s || '').toLowerCase() === 'completed';
	if (completed(a.status) !== completed(b.status)) {
		return completed(a.status) ? 1 : -1;
	}
	const pr = taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
	if (pr !== 0) return pr;
	const da = a.due_at ? Date.parse(a.due_at) : Number.NaN;
	const db = b.due_at ? Date.parse(b.due_at) : Number.NaN;
	const aValid = Number.isFinite(da);
	const bValid = Number.isFinite(db);
	if (aValid && bValid && da !== db) return da - db;
	if (aValid && !bValid) return -1;
	if (!aValid && bValid) return 1;
	return a.title.localeCompare(b.title);
}

function alertSeverityRank(severity: string | null | undefined): number {
	const v = String(severity || 'medium').toLowerCase();
	const order: Record<string, number> = {
		critical: 0,
		high: 1,
		medium: 2,
		low: 3,
	};
	return order[v] ?? 2;
}

function alertStatusRank(status: string | null | undefined): number {
	const v = String(status || 'open').toLowerCase();
	const order: Record<string, number> = {
		open: 0,
		acknowledged: 1,
		resolved: 2,
	};
	return order[v] ?? 0;
}

export function compareAlerts(a: MarketingAlert, b: MarketingAlert): number {
	const sr = alertSeverityRank(a.severity) - alertSeverityRank(b.severity);
	if (sr !== 0) return sr;
	const st = alertStatusRank(a.status) - alertStatusRank(b.status);
	if (st !== 0) return st;
	return a.title.localeCompare(b.title);
}

export function taskPriorityBadgeClass(
	priority: string | null | undefined
): string {
	const v = String(priority || 'medium').toLowerCase();
	if (v === 'urgent') {
		return 'bg-red-500/14 text-red-100/95 ring-red-400/35';
	}
	if (v === 'high') {
		return 'bg-amber-500/14 text-amber-100/95 ring-amber-400/35';
	}
	if (v === 'low') {
		return 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary) ring-(--desktop-border-subtle)';
	}
	return 'bg-(--mc-accent-10) text-(--mc-accent) ring-(--mc-accent-40)/50';
}

export function taskStatusBadgeClass(
	status: string | null | undefined
): string {
	const v = String(status || 'open').toLowerCase();
	if (v === 'completed') {
		return 'bg-emerald-500/12 text-emerald-100/95 ring-emerald-400/30';
	}
	if (v === 'blocked') {
		return 'bg-red-500/12 text-red-100/90 ring-red-400/30';
	}
	if (v === 'in_progress') {
		return 'bg-sky-500/12 text-sky-100/95 ring-sky-400/30';
	}
	return 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary) ring-(--desktop-border-subtle)';
}

export function alertSeverityBadgeClass(
	severity: string | null | undefined
): string {
	const v = String(severity || 'medium').toLowerCase();
	if (v === 'critical') {
		return 'bg-red-500/16 text-red-50/95 ring-red-400/40';
	}
	if (v === 'high') {
		return 'bg-orange-500/14 text-orange-100/95 ring-orange-400/35';
	}
	if (v === 'low') {
		return 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary) ring-(--desktop-border-subtle)';
	}
	return 'bg-(--mc-accent-10) text-(--mc-accent) ring-(--mc-accent-40)/50';
}

export function alertStatusBadgeClass(
	status: string | null | undefined
): string {
	const v = String(status || 'open').toLowerCase();
	if (v === 'resolved') {
		return 'bg-emerald-500/12 text-emerald-100/95 ring-emerald-400/30';
	}
	if (v === 'acknowledged') {
		return 'bg-amber-500/12 text-amber-100/90 ring-amber-400/28';
	}
	return 'bg-(--desktop-surface-soft) text-(--desktop-text-secondary) ring-(--desktop-border-subtle)';
}

export function isTaskOverdue(task: MarketingTask): boolean {
	const status = String(task.status || '').toLowerCase();
	if (status === 'completed' || status === 'cancelled') return false;
	if (!task.due_at) return false;
	const due = Date.parse(task.due_at);
	return Number.isFinite(due) && due < Date.now();
}
