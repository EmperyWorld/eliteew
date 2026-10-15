/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Welcome intro step before first question — context, reward, and single Start CTA.
 */
import { cn } from '@/utils/cn';
import { ClockIcon, GiftIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyUserDetail } from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	SH_RUNNER_HERO_CLASS,
	SH_RUNNER_REWARD_CHIP_CLASS,
} from './surveyHubLayoutTokens';
import { estimateSurveyMinutes, surveyHasReward } from './surveyHubUserUtils';
import { SurveyUserDeadlineBadge } from './SurveyUserDeadlineBadge';

type Props = {
	survey: SurveyUserDetail;
	questionCount: number;
	onStart: () => void;
	onCancel: () => void;
};

export function SurveyRunnerIntro({
	survey,
	questionCount,
	onStart,
	onCancel,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const estimatedMinutes = estimateSurveyMinutes(questionCount);
	const showReward = surveyHasReward(survey.reward);
	const reward = survey.reward;

	return (
		<section
			className={cn(SH_RUNNER_HERO_CLASS, 'mx-4 mb-4 flex flex-col gap-5 p-6')}
		>
			<header className="space-y-2">
				<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>{survey.title}</h2>
				{survey.description_user ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'max-w-2xl text-(--desktop-text-secondary)'
						)}
					>
						{survey.description_user}
					</p>
				) : null}
			</header>

			<div className="flex flex-wrap items-center gap-3">
				<SurveyUserDeadlineBadge closesAt={survey.closes_at} />
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'inline-flex items-center gap-1 text-(--desktop-text-muted)'
					)}
				>
					<ClockIcon
						className="h-3.5 w-3.5 shrink-0"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{t('runner.durationEstimate', { minutes: estimatedMinutes })}
					{' · '}
					{t('runner.introQuestionCount', { count: questionCount })}
				</span>
			</div>

			{showReward ? (
				<div className="flex flex-wrap items-center gap-2">
					<GiftIcon
						className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('runner.rewardPreview')}
					</span>
					{reward.ugs_credits > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('badges.ugs', { count: reward.ugs_credits })}
						</span>
					) : null}
					{reward.ew_balance > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('badges.ew', { count: reward.ew_balance })}
						</span>
					) : null}
					{reward.web_search_coins > 0 ? (
						<span className={SH_RUNNER_REWARD_CHIP_CLASS}>
							{t('badges.coins', { count: reward.web_search_coins })}
						</span>
					) : null}
				</div>
			) : null}

			<details className="max-w-xl">
				<summary
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'cursor-pointer list-none text-(--desktop-text-dim) marker:content-none [&::-webkit-details-marker]:hidden'
					)}
				>
					{t('runner.keyboardHintMore')}
				</summary>
				<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.caption)}>
					{t('runner.keyboardHintExtended')}
				</p>
			</details>

			<div className="flex flex-wrap items-center gap-2 pt-1">
				<DesktopAppButton type="button" variant="accent" onClick={onStart}>
					{t('runner.introStart')}
				</DesktopAppButton>
				<DesktopAppButton type="button" variant="ghost" onClick={onCancel}>
					{t('runner.cancel')}
				</DesktopAppButton>
			</div>
		</section>
	);
}
