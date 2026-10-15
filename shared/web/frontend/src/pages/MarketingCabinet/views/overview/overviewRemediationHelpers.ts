/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Remediation/localization helpers and pressable focus class for Marketing Cabinet overview panels.
 *
 * Invariants:
 * - Helpers are pure; no React state. Severity gate for alert creation stays critical|high.
 *
 * Related:
 * - IssueRemediationStatus.tsx, OverviewAnalyticsPanels.tsx, OverviewActivityPanels.tsx
 */

import { cn } from '@/utils/cn';
import {
	formatDateTime,
	localizeOverviewInsight,
} from '@/pages/MarketingCabinet/locales';
import type {
	MarketingAlert,
	MarketingIssueRemediation,
	MarketingTask,
} from '@/pages/MarketingCabinet/marketingCabinetApi';

export const overviewPressableFocus =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50';

export function canCreateAlertForSeverity(severity?: string | null): boolean {
	return severity === 'critical' || severity === 'high';
}

export function remediationStateLabel(
	remediation: MarketingIssueRemediation | null | undefined,
	t: (key: string, options?: Record<string, unknown>) => string
): string {
	if (!remediation || remediation.state === 'none') {
		return t('overview.remediation.none');
	}

	const parts: string[] = [];
	if ((remediation.task_count ?? 0) > 0) {
		parts.push(
			t('overview.remediation.tasksCount', { count: remediation.task_count })
		);
	}
	if ((remediation.alert_count ?? 0) > 0) {
		parts.push(
			t('overview.remediation.alertsCount', { count: remediation.alert_count })
		);
	}
	return parts.join(' · ') || t('overview.remediation.exists');
}

export function remediationStateClasses(
	remediation: MarketingIssueRemediation | null | undefined,
	neutralInset: string
): string {
	if (!remediation || remediation.state === 'none') {
		return cn(neutralInset, 'text-(--desktop-text-muted)');
	}
	if (remediation.state === 'task_and_alert') {
		return 'border-(--mc-accent-35) bg-(--desktop-surface-accent) text-[rgb(var(--desktop-fg-primary-rgb))]';
	}
	if (remediation.state === 'task') {
		return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-primary)';
	}
	return 'border-(--mc-border-accent-soft) bg-(--mc-readonly-banner-bg) text-(--desktop-text-secondary)';
}

export function remediationOwnerLabel(
	remediation: MarketingIssueRemediation | null | undefined,
	t: (key: string, options?: Record<string, unknown>) => string
): string | null {
	if (!remediation || remediation.state === 'none') {
		return null;
	}
	const owner = remediation.task_owner_name || remediation.alert_owner_name;
	return owner
		? t('overview.remediation.owner', { owner })
		: t('overview.remediation.ownerUnset');
}

export function remediationDeadlineLabel(
	remediation: MarketingIssueRemediation | null | undefined,
	t: (key: string, options?: Record<string, unknown>) => string
): string | null {
	if (!remediation?.task_id) {
		return null;
	}
	return remediation.task_due_at
		? t('overview.remediation.due', {
				due: formatDateTime(remediation.task_due_at),
			})
		: t('overview.remediation.dueUnset');
}

export function remediationAttentionBadges(
	remediation: MarketingIssueRemediation | null | undefined,
	t: (key: string, options?: Record<string, unknown>) => string
): Array<{ key: string; label: string; className: string }> {
	if (!remediation || remediation.state === 'none') {
		return [];
	}

	const badges: Array<{ key: string; label: string; className: string }> = [];
	if (remediation.task_is_overdue) {
		badges.push({
			key: 'overdue',
			label: t('overview.remediation.overdue'),
			className: 'border-red-500/30 bg-red-950/30 text-red-200/90',
		});
	}
	if (remediation.task_needs_owner) {
		badges.push({
			key: 'unassigned',
			label: t('overview.remediation.unassigned'),
			className:
				'border-(--mc-border-accent-soft) bg-(--mc-accent-10) text-(--desktop-text-secondary)',
		});
	}
	return badges;
}

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

export function getLocalizedOverviewTaskCopy(
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

export function getLocalizedOverviewAlertCopy(
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
