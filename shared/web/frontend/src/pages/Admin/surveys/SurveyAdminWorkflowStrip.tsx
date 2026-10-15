/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draft survey workflow strip: editor → audience → results (admin navigation aid).
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

export type SurveyAdminWorkflowTab = 'editor' | 'audience' | 'results';

type Props = {
	active: SurveyAdminWorkflowTab;
	surveyTitle: string;
	status: string;
	questionCount?: number;
	eligibleCount?: number | null;
	readinessReady?: number;
	readinessTotal?: number;
	completedCount?: number;
	completionRate?: number | null;
	onSelect: (tab: SurveyAdminWorkflowTab) => void;
};

const STEPS: SurveyAdminWorkflowTab[] = ['editor', 'audience', 'results'];

export function SurveyAdminWorkflowStrip({
	active,
	surveyTitle,
	status,
	questionCount = 0,
	eligibleCount = null,
	readinessReady = 0,
	readinessTotal = 5,
	completedCount = 0,
	completionRate = null,
	onSelect,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<div className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className={DESKTOP_TYPOGRAPHY.labelOverline}>
						{t('admin.workflow.label')}
					</p>
					<p className="mt-1 truncate font-medium text-(--desktop-text-primary)">
						{surveyTitle}
					</p>
				</div>
				<span
					className={cn(
						'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium',
						status === 'published'
							? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb))]'
							: status === 'archived'
								? 'border-(--desktop-border-subtle) text-(--desktop-text-muted)'
								: 'border-(--desktop-border-subtle) text-(--desktop-text-secondary)'
					)}
				>
					{t(`admin.status.${status}`, { defaultValue: status })}
				</span>
			</div>
			<nav
				className="mt-4 flex flex-wrap gap-2"
				aria-label={t('admin.workflow.aria')}
			>
				{STEPS.map((id, index) => {
					const isActive = active === id;
					return (
						<button
							key={id}
							type="button"
							className={cn(
								'flex items-center gap-2 rounded-(--desktop-radius) border px-3 py-1.5 text-sm transition-colors',
								isActive
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary) hover:border-[rgb(var(--desktop-accent-rgb)/0.28)]'
							)}
							onClick={() => onSelect(id)}
						>
							<span
								className={cn(
									'flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold',
									isActive
										? 'bg-[rgb(var(--desktop-accent-rgb))] text-white'
										: 'bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
								)}
								aria-hidden
							>
								{index + 1}
							</span>
							{t(`admin.workflow.steps.${id}`)}
						</button>
					);
				})}
			</nav>
			{status === 'published' ? (
				<p className={cn('mt-3', DESKTOP_TYPOGRAPHY.meta)}>
					{t('admin.workflow.publishedMeta', { count: completedCount })}
					{completionRate !== null
						? ` · ${t('admin.workflow.completionRate', {
								rate: Math.round(completionRate * 100),
							})}`
						: ''}
				</p>
			) : status === 'draft' ? (
				<p className={cn('mt-3', DESKTOP_TYPOGRAPHY.meta)}>
					{t('admin.workflow.draftMeta', {
						questions: questionCount,
						ready: readinessReady,
						total: readinessTotal,
					})}
					{eligibleCount !== null
						? ` · ${t('admin.workflow.draftEligible', { count: eligibleCount })}`
						: ''}
					{completionRate !== null
						? ` · ${t('admin.workflow.completionRate', {
								rate: Math.round(completionRate * 100),
							})}`
						: ''}
				</p>
			) : null}
		</div>
	);
}
