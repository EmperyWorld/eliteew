/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium runner hero: progress, reward preview, duration estimate, and trust note.
 *
 * Invariants:
 * - One visual context strip above the active question; no duplicate survey title.
 *
 * Related:
 * - SurveyRunner.tsx · surveyHubLayoutTokens.ts
 */
import { cn } from '@/utils/cn';
import { GiftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyUserDetail } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	SH_RUNNER_HERO_CLASS,
	SH_RUNNER_PROGRESS_FILL_CLASS,
	SH_RUNNER_PROGRESS_TRACK_CLASS,
} from './surveyHubLayoutTokens';
import { SurveyRunnerStepDots } from './SurveyRunnerStepDots';
import { estimateSurveyMinutes, surveyHasReward } from './surveyHubUserUtils';

type Props = {
	survey: SurveyUserDetail;
	questionCount: number;
	answeredCount: number;
	currentStep: number;
	review: boolean;
	progress: number;
	stepLabel: string;
	onSelectStep: (index: number) => void;
};

export function SurveyRunnerHero({
	survey,
	questionCount,
	answeredCount,
	currentStep,
	review,
	progress,
	stepLabel,
	onSelectStep,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const estimatedMinutes = estimateSurveyMinutes(questionCount);
	const showReward = surveyHasReward(survey.reward);
	const stepsLeft = review ? 0 : Math.max(0, questionCount - currentStep - 1);

	return (
		<section className={SH_RUNNER_HERO_CLASS} aria-label={stepLabel}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1 space-y-1">
					<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'font-medium')}>
						{stepLabel}
					</p>
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{review
							? t('runner.reviewPhaseHint')
							: t('runner.durationEstimate', { minutes: estimatedMinutes })}
						{!review && stepsLeft > 0
							? ` · ${t('runner.stepsRemaining', { count: stepsLeft })}`
							: ''}
						{answeredCount > 0
							? ` · ${t('runner.answeredCount', {
									answered: answeredCount,
									total: questionCount,
								})}`
							: ''}
					</p>
				</div>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'tabular-nums text-(--desktop-text-secondary)'
					)}
				>
					{progress}%
				</p>
			</div>

			<div
				className={cn(SH_RUNNER_PROGRESS_TRACK_CLASS, 'mt-3')}
				role="progressbar"
				aria-valuenow={progress}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={stepLabel}
			>
				<div
					className={SH_RUNNER_PROGRESS_FILL_CLASS}
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
				<SurveyRunnerStepDots
					questionCount={questionCount}
					currentStep={currentStep}
					review={review}
					onSelectStep={onSelectStep}
				/>
				{showReward ? (
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'inline-flex items-center gap-1 rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2 py-0.5 text-(--desktop-text-secondary)'
						)}
					>
						<GiftIcon
							className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('runner.rewardPreview')}
						{survey.reward.ugs_credits > 0
							? ` · ${t('badges.ugs', { count: survey.reward.ugs_credits })}`
							: ''}
						{survey.reward.ew_balance > 0
							? ` · ${t('badges.ew', { count: survey.reward.ew_balance })}`
							: ''}
						{survey.reward.web_search_coins > 0
							? ` · ${t('badges.coins', { count: survey.reward.web_search_coins })}`
							: ''}
					</span>
				) : null}
			</div>

			{review ? (
				<p
					className={cn(
						'mt-3 flex items-start gap-1.5',
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-muted)'
					)}
				>
					<ShieldCheckIcon
						className="mt-0.5 h-3.5 w-3.5 shrink-0"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('runner.trustNote')}
				</p>
			) : (
				<details className="mt-2">
					<summary
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'cursor-pointer list-none text-(--desktop-text-dim) marker:content-none [&::-webkit-details-marker]:hidden'
						)}
					>
						{t('runner.keyboardHintMore')}
					</summary>
					<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.caption)}>
						{t('runner.keyboardHint')}
					</p>
				</details>
			)}
		</section>
	);
}
