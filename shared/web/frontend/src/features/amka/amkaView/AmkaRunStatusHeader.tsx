/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run status header: pipeline timeline, badges, control center metrics, timestamps.
 *
 * Invariants:
 * - Does not include destructive banner, overview health, progress bar, or error panel.
 *
 * Related:
 * - AmkaPipelineTimeline.tsx, AmkaRunQualityHints.tsx
 */

import { useTranslation } from 'react-i18next';

import { AmkaCoreAlignmentSection } from '@/features/amka/AmkaCoreAlignmentSection';
import { AmkaPipelineTimeline } from '@/features/amka/AmkaPipelineTimeline';
import { AmkaRunQualityHints } from '@/features/amka/AmkaRunQualityHints';
import type { buildAmkaOperationReview } from '@/features/amka/amkaOperationReviewModel';
import {
	AMKA_RUN_TERMINAL,
	amkaRunStatusClass,
	formatShortDate,
} from '@/features/amka/amkaViewUtils';
import type {
	AmkaRun,
	AmkaRunDetailResponse,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { cn } from '@/utils/cn';

type OperationReview = ReturnType<typeof buildAmkaOperationReview>;

type AmkaRunStatusHeaderProps = {
	selectedRun: AmkaRun;
	selectedRunId: string | null;
	progressStreamLive: boolean;
	auditFallbackRatio: { fallback: number; total: number } | null;
	operationReview: OperationReview;
	pulse: AmkaRunDetailResponse['pulse'];
	standaloneProjection: AmkaRunDetailResponse['standalone_projection'];
	hasTruncatedSectionAuditContext: boolean;
};

export function AmkaRunStatusHeader({
	selectedRun,
	selectedRunId,
	progressStreamLive,
	auditFallbackRatio,
	operationReview,
	pulse,
	standaloneProjection,
	hasTruncatedSectionAuditContext,
}: AmkaRunStatusHeaderProps) {
	const { t } = useTranslation('marketing');

	return (
		<>
			<AmkaPipelineTimeline run={selectedRun} />
			<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
				<div className="space-y-2">
					<div
						className="flex flex-wrap items-center gap-2"
						aria-live="polite"
						aria-atomic="true"
					>
						<span
							className={cn(
								'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
								amkaRunStatusClass(selectedRun.status)
							)}
						>
							{t(`amkaView.status.${selectedRun.status}`)}
						</span>
						{!AMKA_RUN_TERMINAL.has(selectedRun.status) ? (
							<span
								className={cn(
									'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-(--desktop-border-subtle)',
									progressStreamLive
										? 'bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
										: 'bg-(--desktop-surface-soft)/80 text-(--desktop-text-secondary)'
								)}
								title={
									progressStreamLive
										? t('amkaView.progressStreamLiveHint')
										: t('amkaView.progressStreamPollHint')
								}
							>
								{progressStreamLive
									? t('amkaView.progressStreamLive')
									: t('amkaView.progressStreamPoll')}
							</span>
						) : null}
						<span className="text-xs text-(--desktop-text-secondary)">
							{t('amkaView.progressLabel', {
								progress: selectedRun.progress,
							})}
						</span>
					</div>
					{selectedRun.plan_source ? (
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-(--desktop-text-secondary)">
							<span className="font-medium text-(--desktop-text-muted)">
								{t('amkaView.planContractSummaryLabel')}
							</span>
							<span className="rounded-md bg-(--desktop-surface-panel) px-1.5 py-0.5 ring-1 ring-(--desktop-border-subtle)">
								{selectedRun.plan_source === 'llm'
									? t('amkaView.planSourceLlm')
									: t('amkaView.planSourceHeuristic')}
							</span>
							{selectedRun.plan_llm_status ? (
								<span className="text-(--desktop-text-muted)">
									{t(`amkaView.planLlmStatus.${selectedRun.plan_llm_status}`, {
										defaultValue: selectedRun.plan_llm_status,
									})}
								</span>
							) : null}
							<span className="text-(--desktop-text-muted)">
								{selectedRun.plan_used_llm_tasks === true
									? t('amkaView.planUsedLlmTasksYes')
									: selectedRun.plan_used_llm_tasks === false
										? t('amkaView.planUsedLlmTasksNo')
										: '—'}
							</span>
							{selectedRun.plan_llm_repaired ? (
								<span className="rounded-md bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-1.5 py-0.5 font-medium text-(--desktop-text-primary)">
									{t('amkaView.planRepairedBadge')}
								</span>
							) : null}
						</div>
					) : null}
					<AmkaRunQualityHints
						planLlmStatus={selectedRun.plan_llm_status}
						auditFallbackRatio={auditFallbackRatio}
						pulse={pulse ?? null}
						projection={standaloneProjection ?? null}
						runStatus={selectedRun.status}
					/>
					<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/45 p-3">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<div className="text-xs font-semibold uppercase tracking-[0.12em] text-(--desktop-text-muted)">
									{t('amkaView.controlCenterTitle')}
								</div>
								<p className="mt-1 text-xs text-(--desktop-text-secondary) wrap-pretty">
									{t('amkaView.controlCenterHint')}
								</p>
							</div>
							<span className="rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
								{operationReview.items.length}{' '}
								{t('amkaView.operationReviewCountSuffix')}
							</span>
						</div>
						<dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
								<dt className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
									{t('amkaView.controlAuditFallback')}
								</dt>
								<dd className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
									{operationReview.metrics.auditFallbackRatio === null
										? '—'
										: `${Math.round(operationReview.metrics.auditFallbackRatio * 100)}%`}
								</dd>
							</div>
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
								<dt className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
									{t('amkaView.controlPlanSource')}
								</dt>
								<dd className="mt-1 text-sm font-semibold text-(--desktop-text-primary)">
									{operationReview.metrics.planSource || '—'} ·{' '}
									{operationReview.metrics.planLlmStatus || '—'}
								</dd>
							</div>
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
								<dt className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
									{t('amkaView.controlRiskOps')}
								</dt>
								<dd className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
									{operationReview.metrics.destructiveCount} /{' '}
									{operationReview.metrics.failedOrNoSaveOperations}
								</dd>
							</div>
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) px-3 py-2">
								<dt className="text-[11px] uppercase tracking-[0.12em] text-(--desktop-text-muted)">
									{t('amkaView.controlZeroSaveAndCandidates')}
								</dt>
								<dd className="mt-1 text-lg font-semibold text-(--desktop-text-primary)">
									{operationReview.metrics.zeroSaveSections} /{' '}
									{operationReview.metrics.reconcileCandidateCount}
								</dd>
							</div>
						</dl>
					</div>
					<AmkaCoreAlignmentSection runId={selectedRunId} />
					{hasTruncatedSectionAuditContext ? (
						<p className="text-xs leading-relaxed text-(--desktop-text-muted) wrap-pretty">
							{t('amkaView.auditContextTruncatedSummary')}
						</p>
					) : null}
					<p className="text-sm text-(--desktop-text-secondary)">
						{selectedRun.progress_message || selectedRun.master_plan_summary}
					</p>
				</div>
				<div className="text-right text-xs text-(--desktop-text-secondary)">
					<div>
						{t('amkaView.createdAtLabel', {
							value: formatShortDate(selectedRun.created_at),
						})}
					</div>
					{selectedRun.approved_at ? (
						<div>
							{t('amkaView.approvedAtLabel', {
								value: formatShortDate(selectedRun.approved_at),
							})}
						</div>
					) : null}
					{selectedRun.started_at ? (
						<div>
							{t('amkaView.startedAtLabel', {
								value: formatShortDate(selectedRun.started_at),
							})}
						</div>
					) : null}
					{selectedRun.completed_at ? (
						<div>
							{t('amkaView.completedAtLabel', {
								value: formatShortDate(selectedRun.completed_at),
							})}
						</div>
					) : null}
					<div>
						{t('amkaView.updatedAtLabel', {
							value: formatShortDate(selectedRun.updated_at),
						})}
					</div>
				</div>
			</div>
		</>
	);
}
