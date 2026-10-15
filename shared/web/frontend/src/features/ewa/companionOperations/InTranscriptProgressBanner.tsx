/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only in-transcript banner for companion operations progress (workflows, music, generic).
 *
 * Invariants:
 * - User workflows show animated step chain when steps are available.
 * - Failed progress is an assertive alert; active/completed progress stays a polite status update.
 *
 * Related:
 * - src/features/ewa/companionOperations/useCompanionTaskEvents.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionWorkflowStepChain } from '@/features/ewa/companionOperations/CompanionWorkflowStepChain';
import { musicPipelinePhaseFromProgress } from '@/features/ewa/companionOperations/companionMusicPhaseLabels';
import {
	type CompanionTranscriptProgressItem,
	isMusicBackgroundIntent,
	isPresentationBackgroundIntent,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	companionProgressBarA11y,
	companionProgressBarValueTextKey,
} from '@/features/ewa/companionUx/companionProgressA11y';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { cn } from '@/lib/utils';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';

export type InTranscriptProgressBannerProps = {
	progress: CompanionTranscriptProgressItem;
	onFocusRun?: (runId: string) => void;
	reducedMotion?: boolean;
};

export function InTranscriptProgressBanner({
	progress,
	onFocusRun,
	reducedMotion = false,
}: InTranscriptProgressBannerProps) {
	const { t } = useTranslation('marketing');
	const pct =
		progress.total > 0
			? Math.min(100, Math.round((progress.current / progress.total) * 100))
			: 0;
	const isFailed = progress.status === 'failed';
	const isCompleted = progress.status === 'completed';
	const isStale = progress.status === 'stale';
	const isUserWorkflow = progress.intentKind === 'user_action_workflow';
	const isMusic =
		isMusicBackgroundIntent(progress.intentKind) ||
		(progress.intentKind === 'action_workflow' && !isUserWorkflow);
	const isPresentation = isPresentationBackgroundIntent(progress.intentKind);
	const isAgentic = progress.intentKind === 'agentic_session';
	const workflowSteps = progress.steps ?? [];
	const showWorkflowChain =
		(isUserWorkflow || isAgentic) && workflowSteps.length > 0;
	const musicPhaseLabel =
		isMusic && progress.total > 0
			? musicPipelinePhaseFromProgress(progress.current, progress.total, t)
			: '';
	const clickable = Boolean(onFocusRun);
	const progressA11y = companionProgressBarA11y(
		progress.current,
		progress.total,
		{ completed: isCompleted, percentScale: true }
	);

	const bannerTitle = isAgentic
		? t('ewaCompanion.operationIntentAgenticSession')
		: isUserWorkflow
			? t('ewaCompanion.workflowProgressTitle')
			: isMusic
				? t('ewaCompanion.musicProgressTitle')
				: isPresentation
					? t('ewaCompanion.presentationProgressTitle')
					: t('ewaCompanion.operationProgressTitle');

	const stepLine = isAgentic
		? progress.subtitle?.trim() ||
			progress.title.trim() ||
			t('ewaCompanion.agenticProgressRunning')
		: isUserWorkflow
			? progress.title.trim()
				? t('ewaCompanion.workflowProgressStep', {
						title: progress.title,
						current: progress.current,
						total: progress.total,
					})
				: t('ewaCompanion.workflowProgressPending')
			: isMusic
				? progress.title.trim()
					? t('ewaCompanion.musicProgressStep', {
							title: progress.title,
							current: progress.current,
							total: progress.total,
						})
					: t('ewaCompanion.musicProgressPending')
				: isPresentation
					? t('ewaCompanion.presentationProgressStep', {
							title: progress.title.trim()
								? progress.title
								: t('ewaCompanion.operationPresentationUntitled'),
							progress: pct,
						})
					: progress.title.trim()
						? progress.title
						: t('ewaCompanion.operationProgressPending');

	return (
		<li
			className={cn(
				'flex flex-col gap-2 border-t border-(--companion-divider) py-2',
				'rounded-md border border-(--companion-divider)/60 bg-(--companion-bg)/80 px-3',
				isFailed && 'border-rose-400/35 bg-rose-500/10',
				clickable && 'cursor-pointer hover:bg-white/4',
				!reducedMotion &&
					!isFailed &&
					!isCompleted &&
					!isStale &&
					'companion-run-live-pulse',
				isStale && 'border-amber-400/35 bg-amber-500/10'
			)}
			data-testid="ewa-companion-task-progress-banner"
			data-run-id={progress.runId}
			data-progress-status={progress.status}
			role={isFailed ? 'alert' : 'status'}
			aria-live={isFailed ? 'assertive' : 'polite'}
			aria-label={
				clickable
					? t('ewaCompanion.transcriptProgressFocusAria', {
							title: stepLine,
							percent: progressA11y.percent,
						})
					: undefined
			}
			{...(clickable
				? {
						onClick: () => onFocusRun?.(progress.runId),
						onKeyDown: (event: KeyboardEvent) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								onFocusRun?.(progress.runId);
							}
						},
						tabIndex: 0,
					}
				: {})}
		>
			<div className="flex flex-col gap-0.5">
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'font-medium uppercase tracking-wider text-(--companion-aura)'
					)}
				>
					{bannerTitle}
				</span>
				<p
					className={cn(
						EWA_COMPANION_TYPOGRAPHY.bodyDense,
						'text-(--desktop-text-primary)',
						isAgentic && 'line-clamp-2'
					)}
				>
					{isAgentic
						? progress.title.trim() ||
							t('ewaCompanion.operationIntentAgenticSession')
						: stepLine}
				</p>
				{isAgentic && progress.subtitle?.trim() ? (
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.micro,
							'text-(--companion-aura)'
						)}
					>
						{progress.subtitle.trim()}
					</p>
				) : null}
				{musicPhaseLabel ? (
					<p
						className={cn(
							EWA_COMPANION_TYPOGRAPHY.micro,
							'text-(--companion-aura)'
						)}
					>
						{musicPhaseLabel}
					</p>
				) : null}
				{isCompleted ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('ewaCompanion.musicProgressCompleted')}
					</p>
				) : null}
				{isFailed ? (
					<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-rose-100/95')}>
						{t('ewaCompanion.musicProgressFailed')}
					</p>
				) : null}
			</div>
			{showWorkflowChain || (isAgentic && workflowSteps.length > 0) ? (
				<CompanionWorkflowStepChain
					steps={workflowSteps}
					compact
					className="mt-0.5 rounded-md border border-(--companion-divider)/40 bg-(--desktop-surface-soft)/20 px-2 py-1.5"
				/>
			) : null}
			{!isFailed ? (
				<div
					className="h-1.5 w-full overflow-hidden rounded-full bg-(--companion-divider)/50"
					role="progressbar"
					aria-valuemin={progressA11y.valueMin}
					aria-valuemax={progressA11y.valueMax}
					aria-valuenow={progressA11y.valueNow}
					aria-valuetext={t(
						companionProgressBarValueTextKey(progressA11y.mode),
						{
							current: progressA11y.current,
							total: progressA11y.total,
							percent: progressA11y.percent,
						}
					)}
				>
					<div
						className={cn(
							'h-full rounded-full transition-[width] duration-500 ease-out',
							isCompleted ? 'bg-emerald-500/80' : 'bg-(--companion-aura)/80'
						)}
						style={{ width: `${isCompleted ? 100 : pct}%` }}
					/>
				</div>
			) : null}
		</li>
	);
}
